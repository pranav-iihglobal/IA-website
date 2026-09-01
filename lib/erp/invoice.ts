import { connectToDatabase } from "@/lib/db/connect";
import type { HydratedDocument } from "mongoose";
import { Invoice, type InvoiceDoc } from "@/lib/db/models/Invoice";
import { Product } from "@/lib/db/models/Product";
import { Contact } from "@/lib/db/models/Contact";
import { recordAudit } from "@/lib/db/models/AuditLog";
import type { LeanDoc } from "@/lib/db/lean";
import { allocateInvoiceNumber } from "./invoice-number";
import {
  computeInvoice,
  supplyTypeFor,
  GUJARAT_STATE_CODE,
  type InvoiceLineInput,
} from "./tax";

/**
 * Raising and cancelling invoices.
 *
 * ONE function issues an invoice. Not because it is tidy, but because issuing
 * is the moment four separate rules all have to hold at once — the rate comes
 * from the product, the number is allocated exactly then, the totals are
 * computed exactly once, and the whole thing is written down rather than left
 * to be recalculated. A second path to an issued invoice is a second place
 * for one of those to be forgotten.
 */

/** What the admin sends: a product, a pack, a quantity, and a price. */
export interface DraftLine {
  productId: string;
  /** Which pack of that product, by its label. */
  packLabel: string;
  quantity: number;
  /**
   * Paise. Sent because a negotiated price is real — a dealer does not always
   * pay the list price. The RATE is never sent; see below.
   */
  unitPricePaise: number;
  discountPaise?: number;
}

export interface IssueRequest {
  contactId: string;
  lines: DraftLine[];
  /** State code — 24 for Gujarat. Decides CGST+SGST versus IGST. */
  placeOfSupplyStateCode?: string;
  transportPaise?: number;
  transportCharged?: boolean;
  notes?: string;
  issuedAt?: Date;
}

export class InvoiceError extends Error {}

/** What a line needs from its product, and nothing more. */
export interface LineProduct {
  name?: { en?: string };
  hsnCode?: string;
  gstRateBps?: number;
  packSizes?: { label?: string }[];
}

/** The snapshot, plus the bits the tax engine has no business knowing about. */
export interface SnapshottedLine {
  tax: InvoiceLineInput;
  productId: string;
  packLabel: string;
}

/**
 * Turn one draft line into a taxed one, reading rate and HSN from the product.
 *
 * THE RATE AND THE HSN ARE NOT ACCEPTED FROM THE CALLER. They come from the
 * product record and nowhere else, which is the structural fix for a rate
 * disagreeing between the master list and an issued document: the value can
 * only be wrong in one place, and it is editable there. The PRICE is accepted,
 * because a negotiated price is real — a dealer does not always pay list.
 *
 * A product with no rate set is refused rather than treated as 0%. Zero is a
 * legitimate GST rate, so "unset" must not be able to look like one: an
 * invoice that silently charges no tax is far worse than one that will not
 * issue.
 *
 * Pure, and separate from the database read, so every one of these rules can
 * be tested without a cluster.
 */
export function snapshotLine(
  line: DraftLine,
  product: LineProduct | undefined,
  index: number,
): SnapshottedLine {
  const at = `Line ${index + 1}`;
  if (!product) throw new InvoiceError(`${at}: that product no longer exists.`);

  const label = product.name?.en ?? "that product";

  if (typeof product.gstRateBps !== "number") {
    throw new InvoiceError(
      `${at}: ${label} has no GST rate set. Set it on the product before invoicing it.`,
    );
  }
  if (!product.hsnCode) {
    throw new InvoiceError(`${at}: ${label} has no HSN code. A tax invoice needs one.`);
  }
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
    throw new InvoiceError(`${at}: quantity must be a whole number above zero.`);
  }
  if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) {
    throw new InvoiceError(`${at}: the price is not a valid amount.`);
  }

  const pack = (product.packSizes ?? []).find((p) => p.label === line.packLabel);

  return {
    tax: {
      description: [product.name?.en, line.packLabel].filter(Boolean).join(" — "),
      hsn: product.hsnCode,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      discountPaise: line.discountPaise ?? 0,
      gstRateBps: product.gstRateBps,
    },
    productId: line.productId,
    packLabel: pack?.label ?? line.packLabel,
  };
}

/** Fetch the products these lines name, then snapshot each one. */
async function snapshotLines(lines: DraftLine[]): Promise<SnapshottedLine[]> {
  if (lines.length === 0) throw new InvoiceError("An invoice needs at least one line.");

  const products = await Product.find({ _id: { $in: lines.map((l) => l.productId) } })
    .select("name sku hsnCode gstRateBps packSizes")
    .lean();
  const byId = new Map(products.map((p: LeanDoc) => [String(p._id), p as LineProduct]));

  return lines.map((line, i) => snapshotLine(line, byId.get(line.productId), i));
}

/**
 * Issue an invoice.
 *
 * The number is allocated HERE and not a moment earlier. A number handed out
 * when a draft is started would leave a gap in the series every time someone
 * abandoned one, and a missing number in a GST sequence is a question from
 * the department rather than a cosmetic flaw.
 */
export async function issueInvoice(
  request: IssueRequest,
  actor: string,
): Promise<HydratedDocument<InvoiceDoc>> {
  await connectToDatabase();

  const contact = await Contact.findById(request.contactId)
    .select("name businessName phone village taluka district pin state dealer")
    .lean();
  if (!contact) throw new InvoiceError("That customer no longer exists.");

  const snapshotted = await snapshotLines(request.lines);
  const placeOfSupply = request.placeOfSupplyStateCode || GUJARAT_STATE_CODE;
  const supplyType = supplyTypeFor(GUJARAT_STATE_CODE, placeOfSupply);
  const computed = computeInvoice(
    snapshotted.map((s) => s.tax),
    supplyType,
  );

  const issuedAt = request.issuedAt ?? new Date();
  const allocated = await allocateInvoiceNumber(issuedAt);

  const invoice = await Invoice.create({
    number: allocated.number,
    financialYear: allocated.financialYear,
    status: "issued",
    issuedAt,
    contactId: contact._id,
    party: {
      name: contact.name ?? "",
      businessName: contact.businessName ?? "",
      gstin: contact.dealer?.gstin ?? "",
      phone: contact.phone ?? "",
      address: [contact.village, contact.taluka].filter(Boolean).join(", "),
      village: contact.village ?? "",
      district: contact.district ?? "",
      pin: contact.pin ?? "",
      state: contact.state ?? "Gujarat",
    },
    placeOfSupplyStateCode: placeOfSupply,
    supplyType,
    /*
      Zipped by index rather than smuggled through computeInvoice(). The tax
      engine takes lines and returns lines in the same order; it has no
      business carrying a product id, and relying on it to preserve keys it
      does not know about would break silently the day it stopped spreading.
    */
    lines: computed.lines.map((line, i) => {
      return {
        productId: snapshotted[i].productId,
        description: line.description,
        packLabel: snapshotted[i].packLabel,
        hsn: line.hsn,
        quantity: line.quantity,
        unitPricePaise: line.unitPricePaise,
        discountPaise: line.discountPaise ?? 0,
        gstRateBps: line.gstRateBps,
        taxableValuePaise: line.taxableValuePaise,
        cgstPaise: line.cgstPaise,
        sgstPaise: line.sgstPaise,
        igstPaise: line.igstPaise,
        lineTotalPaise: line.lineTotalPaise,
      };
    }),
    subtotalPaise: computed.subtotalPaise,
    cgstPaise: computed.cgstPaise,
    sgstPaise: computed.sgstPaise,
    igstPaise: computed.igstPaise,
    totalTaxPaise: computed.totalTaxPaise,
    roundOffPaise: computed.roundOffPaise,
    grandTotalPaise: computed.grandTotalPaise,
    amountInWords: computed.amountInWords,
    transportPaise: request.transportPaise ?? 0,
    transportCharged: Boolean(request.transportCharged),
    notes: request.notes ?? "",
    createdBy: actor,
  });

  await recordAudit({
    actor,
    action: "issue",
    entity: "Invoice",
    entityId: String(invoice._id),
    after: {
      number: invoice.number,
      grandTotalPaise: invoice.grandTotalPaise,
      party: invoice.party.name,
    },
  });

  return invoice;
}

/**
 * Cancel an issued invoice. NEVER a delete.
 *
 * The number stays with it. A gap in a GST series is something the department
 * asks about, and "we deleted it" is not an answer — a cancelled invoice that
 * still occupies its number is.
 */
export async function cancelInvoice(
  id: string,
  reason: string,
  actor: string,
): Promise<HydratedDocument<InvoiceDoc>> {
  await connectToDatabase();

  const invoice = await Invoice.findById(id);
  if (!invoice) throw new InvoiceError("That invoice does not exist.");
  if (invoice.isHistorical) {
    throw new InvoiceError(
      "This invoice was already filed with the GST department and cannot be cancelled here.",
    );
  }
  if (invoice.status === "cancelled") throw new InvoiceError("Already cancelled.");
  if (invoice.status !== "issued") throw new InvoiceError("Only an issued invoice can be cancelled.");

  invoice.status = "cancelled";
  invoice.cancelledAt = new Date();
  invoice.cancelledReason = reason.trim();
  await invoice.save();

  await recordAudit({
    actor,
    action: "cancel",
    entity: "Invoice",
    entityId: String(invoice._id),
    before: { status: "issued" },
    after: { status: "cancelled", reason: invoice.cancelledReason },
    note: `${invoice.number} kept its number.`,
  });

  return invoice;
}
