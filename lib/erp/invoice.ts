import { connectToDatabase } from "@/lib/db/connect";
import type { HydratedDocument } from "mongoose";
import { Invoice, type InvoiceDoc } from "@/lib/db/models/Invoice";
import { Product } from "@/lib/db/models/Product";
import { Contact } from "@/lib/db/models/Contact";
import { recordAudit } from "@/lib/db/models/AuditLog";
import { getSeller } from "@/lib/admin/settings";
import { applyTradingDelta, convertOnFirstOrder, tradingDelta } from "@/lib/crm/trading";
import type { LeanDoc } from "@/lib/db/lean";
import { allocateCreditNoteNumber, allocateInvoiceNumber } from "./invoice-number";
import {
  computeInvoice,
  supplyTypeFor,
  clampDiscount,
  resolveDiscount,
  type DiscountType,
  GUJARAT_STATE_CODE,
  type InvoiceLineInput,
} from "./tax";
import { toPieces, type Uom } from "./quantity";
import { InvoiceError } from "./invoice-error";
import { pickScheme, type SchemeRule } from "./schemes";
import { schemesActiveAt } from "./scheme-store";
import {
  assertNoShortage,
  deductStock,
  movesFromLines,
  planStockMoves,
  restoreStock,
  shelfItemsFor,
} from "./stock-moves";

export { InvoiceError };

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
  /** Pieces — or boxes when uom is "box"; snapshotLine multiplies out. */
  quantity: number;
  uom?: Uom;
  /**
   * Paise. Sent because a negotiated price is real — a dealer does not always
   * pay the list price. The RATE is never sent; see below.
   */
  unitPricePaise: number;
  /** Flat paise or percent in basis points — see resolveDiscount(). Default flat 0. */
  discountType?: DiscountType;
  discountValue?: number;
}

export interface IssueRequest {
  contactId: string;
  lines: DraftLine[];
  /** State code — 24 for Gujarat. Decides CGST+SGST versus IGST. */
  placeOfSupplyStateCode?: string;
  notes?: string;
  issuedAt?: Date;
}

/** What a line needs from its product, and nothing more. */
export interface LineProduct {
  name?: { en?: string };
  hsnCode?: string;
  gstRateBps?: number;
  packSizes?: { label?: string; unitsPerBox?: number }[];
}

/** The snapshot, plus the bits the tax engine has no business knowing about. */
export interface SnapshottedLine {
  tax: InvoiceLineInput;
  productId: string;
  packLabel: string;
  /** How the discount was stated; tax.discountPaise is what it came to. */
  discountType: DiscountType;
  discountValue: number;
  /** How the quantity was ordered; tax.quantity is always pieces. */
  uom: Uom;
  boxes: number;
  unitsPerBox: number;
  /** The seasonal scheme that supplied the discount, when nothing was typed. */
  schemeId: string | null;
  schemeName: string;
}

/**
 * What the moment of issue knows that a line does not: which schemes are
 * live, and whose invoice this is. Optional, because a test of the rate and
 * HSN rules has no business setting up a season.
 */
export interface IssueContext {
  schemes: SchemeRule[];
  /** The party's channel — b2c or b2b — for schemes aimed at one side. */
  channel: string;
  at: Date;
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
  context?: IssueContext,
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

  /*
    Boxes become pieces HERE, once. Everything downstream — tax, the HSN
    summary, the credit ceiling, stock — counts pieces; how it was ordered is
    kept beside them so the print can say "3 boxes (30)".
  */
  const packForBox = (product.packSizes ?? []).find((p) => p.label === line.packLabel);
  const uom: Uom = line.uom ?? "piece";
  const unitsPerBox = packForBox?.unitsPerBox ?? 0;
  if (uom === "box" && !(Number.isInteger(unitsPerBox) && unitsPerBox > 0)) {
    throw new InvoiceError(
      `${at}: that pack is not sold by the box — set packs per box on the product, or order pieces.`,
    );
  }
  const boxes = uom === "box" ? line.quantity : 0;
  const pieces = toPieces(line.quantity, uom, unitsPerBox);
  if (!Number.isInteger(line.unitPricePaise) || line.unitPricePaise < 0) {
    throw new InvoiceError(`${at}: the price is not a valid amount.`);
  }

  /*
    The discount, as stated and as it comes to. A percentage is basis points
    and may not exceed 100%; a flat amount is whole paise and may not be
    negative. Either is then clamped to the line, so the most a discount can
    do is make the line free — see clampDiscount().
  */
  const discountType: DiscountType = line.discountType ?? "flat";
  const discountValue = line.discountValue ?? 0;
  if (!Number.isInteger(discountValue) || discountValue < 0) {
    throw new InvoiceError(`${at}: the discount is not a valid amount.`);
  }
  if (discountType === "percent" && discountValue > 10_000) {
    throw new InvoiceError(`${at}: a discount cannot be more than 100%.`);
  }
  const grossPaise = pieces * line.unitPricePaise;
  const typed = clampDiscount(
    grossPaise,
    resolveDiscount(grossPaise, discountType, discountValue),
  );

  /*
    A typed discount wins; a scheme fills the blank. The person raising the
    invoice knows something the rule does not — a negotiated price, a
    complaint being settled — so anything typed, even a smaller amount than
    the scheme would give, is what goes on the document. Where nothing was
    typed, the best live scheme for this pack and this party supplies the
    discount AND its own type and value, so the print reads "10%" the way a
    typed percentage would, with the scheme's name beside it.
  */
  const applied =
    typed === 0 && context
      ? pickScheme(
          context.schemes,
          { productId: line.productId, channel: context.channel },
          grossPaise,
          context.at,
        )
      : null;
  const discountPaise = applied ? applied.discountPaise : typed;

  const pack = (product.packSizes ?? []).find((p) => p.label === line.packLabel);

  return {
    tax: {
      description: [product.name?.en, line.packLabel].filter(Boolean).join(" — "),
      hsn: product.hsnCode,
      quantity: pieces,
      unitPricePaise: line.unitPricePaise,
      discountPaise,
      gstRateBps: product.gstRateBps,
    },
    productId: line.productId,
    packLabel: pack?.label ?? line.packLabel,
    discountType: applied ? applied.scheme.discountType : discountType,
    discountValue: applied ? applied.scheme.discountValue : discountValue,
    uom,
    boxes,
    unitsPerBox: uom === "box" ? unitsPerBox : 0,
    schemeId: applied ? applied.scheme.id : null,
    schemeName: applied ? applied.scheme.name : "",
  };
}

/**
 * The share of a line's discount that a credit note takes with it.
 *
 * A credit note used to carry NO discount, so crediting a discounted line in
 * full did not cancel it: 10 × ₹100 less ₹100 invoiced ₹900, the note gave
 * back ₹1,000. The share is pro rata by quantity and TELESCOPES — the amount
 * for this pick is the cumulative share after it minus the share already
 * given — so however a line is credited in parts, the parts sum to exactly
 * the original discount, to the paisa.
 */
export function creditDiscount(
  originalDiscountPaise: number,
  originalQuantity: number,
  alreadyCreditedQuantity: number,
  pickQuantity: number,
): number {
  if (originalQuantity <= 0 || originalDiscountPaise === 0) return 0;
  const share = (upTo: number) =>
    Math.round((originalDiscountPaise * Math.min(upTo, originalQuantity)) / originalQuantity);
  return share(alreadyCreditedQuantity + pickQuantity) - share(alreadyCreditedQuantity);
}

/** Fetch the products these lines name, then snapshot each one. */
export async function snapshotLines(
  lines: DraftLine[],
  context: IssueContext,
): Promise<SnapshottedLine[]> {
  if (lines.length === 0) throw new InvoiceError("An invoice needs at least one line.");

  const products = await Product.find({ _id: { $in: lines.map((l) => l.productId) } })
    .select("name sku hsnCode gstRateBps packSizes")
    .lean();
  const byId = new Map(products.map((p: LeanDoc) => [String(p._id), p as LineProduct]));

  return lines.map((line, i) => snapshotLine(line, byId.get(line.productId), i, context));
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
    .select("name businessName phone village taluka district pin state dealer kind channel stage")
    .lean();
  if (!contact) throw new InvoiceError("That customer no longer exists.");

  /*
    The moment of issue is fixed FIRST, because the schemes live at that
    moment decide the discounts, and the number allocated later carries its
    month. One clock reading for the whole document.
  */
  const issuedAt = request.issuedAt ?? new Date();
  const snapshotted = await snapshotLines(request.lines, {
    schemes: await schemesActiveAt(issuedAt),
    channel: contact.channel ?? "",
    at: issuedAt,
  });
  /*
    Who is selling, copied like the party. The setting can change; this
    document must not. sellerSchema guarantees the GSTIN is a Gujarat
    registration, which is what lets the tax engine keep GUJARAT_STATE_CODE
    as home below.
  */
  const seller = await getSeller();
  const placeOfSupply = request.placeOfSupplyStateCode || GUJARAT_STATE_CODE;
  const supplyType = supplyTypeFor(GUJARAT_STATE_CODE, placeOfSupply);
  const computed = computeInvoice(
    snapshotted.map((s) => s.tax),
    supplyType,
  );

  /*
    Stock, BEFORE the number. A line asking for more than is on the shelf is
    refused here, per line, and no number has been consumed by the attempt —
    a refusal that left a gap in the GST series would be a question from the
    department about an invoice that never existed. Only packs with a linked
    stock item take part; the rest are not tracked and never refuse.

    Then the pieces come off, guarded per item, and only then is the number
    allocated. If the write below still fails, the pieces go back; the number
    is wasted, as it always was, and check-erp reports the gap.
  */
  const shelf = await shelfItemsFor(snapshotted);
  const moves = assertNoShortage(
    planStockMoves(
      snapshotted.map((s, index) => ({
        index,
        productId: s.productId,
        packLabel: s.packLabel,
        quantity: s.tax.quantity,
      })),
      shelf,
    ),
  );
  const itemForLine = new Map<number, string>();
  for (const move of moves) {
    for (const index of move.lineIndexes) itemForLine.set(index, move.itemId);
  }

  await deductStock(moves, { note: "sold — invoice being issued", actor });

  let allocated: Awaited<ReturnType<typeof allocateInvoiceNumber>>;
  try {
    allocated = await allocateInvoiceNumber(issuedAt);
  } catch (error) {
    await restoreStock(moves, { note: "returned — the invoice could not be numbered", actor });
    throw error;
  }

  let invoice: HydratedDocument<InvoiceDoc>;
  try {
    invoice = await Invoice.create({
      number: allocated.number,
      financialYear: allocated.financialYear,
      status: "issued",
      issuedAt,
      contactId: contact._id,
      seller,
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
          stockItemId: itemForLine.get(i) ?? null,
          description: line.description,
          packLabel: snapshotted[i].packLabel,
          hsn: line.hsn,
          quantity: line.quantity,
          uom: snapshotted[i].uom,
          boxes: snapshotted[i].boxes,
          unitsPerBox: snapshotted[i].unitsPerBox,
          unitPricePaise: line.unitPricePaise,
          discountPaise: line.discountPaise ?? 0,
          discountType: snapshotted[i].discountType,
          discountValue: snapshotted[i].discountValue,
          schemeId: snapshotted[i].schemeId,
          schemeName: snapshotted[i].schemeName,
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
      notes: request.notes ?? "",
      createdBy: actor,
    });
  } catch (error) {
    await restoreStock(moves, {
      note: `returned — ${allocated.number} could not be written`,
      actor,
    });
    throw error;
  }

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
  if (moves.length > 0) {
    // The stock entries were written before the number existed; name it now.
    await recordAudit({
      actor,
      action: "stock",
      entity: "Invoice",
      entityId: String(invoice._id),
      after: { itemsMoved: moves.length },
      note: `${invoice.number} took ${moves.reduce((n, m) => n + m.quantity, 0)} pieces off the shelf`,
    });
  }

  /*
    The customer record learns about the sale — the stored figures the list
    sorts and filters on — and a sample-stage prospect becomes a customer
    on this, their first real order. Both AFTER the invoice exists.
  */
  await applyTradingDelta(contact._id, tradingDelta(invoice, "apply"), issuedAt);
  await convertOnFirstOrder(contact._id, actor, invoice.number);

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

  /*
    Stock goes the other way from the document. Cancelling an INVOICE puts
    its pieces back on the shelf — after the save, so a refused save leaves
    the shelf as it was. Cancelling a CREDIT NOTE takes them off again, and
    that can be refused: the returned canisters may have been sold since. So
    it happens before the save, and a shortage stops the cancellation.
  */
  const moves = movesFromLines(invoice.lines ?? []);
  const isCreditNote = invoice.documentType === "credit_note";
  if (isCreditNote && moves.length > 0) {
    await deductStock(moves, { note: `sold again — ${invoice.number} cancelled`, actor });
  }

  invoice.status = "cancelled";
  invoice.cancelledAt = new Date();
  invoice.cancelledReason = reason.trim();
  try {
    await invoice.save();
  } catch (error) {
    if (isCreditNote && moves.length > 0) {
      await restoreStock(moves, { note: `returned — ${invoice.number} could not be cancelled`, actor });
    }
    throw error;
  }

  if (!isCreditNote && moves.length > 0) {
    await restoreStock(moves, { note: `returned — ${invoice.number} cancelled`, actor });
  }

  await recordAudit({
    actor,
    action: "cancel",
    entity: "Invoice",
    entityId: String(invoice._id),
    before: { status: "issued" },
    after: { status: "cancelled", reason: invoice.cancelledReason },
    note: `${invoice.number} kept its number.`,
  });

  // The sale did not happen after all; the customer record says so too.
  await applyTradingDelta(invoice.contactId, tradingDelta(invoice, "undo"));

  return invoice;
}


/* -------------------------------------------------------------------------- */
/* Credit notes                                                               */
/* -------------------------------------------------------------------------- */

export interface CreditNoteRequest {
  /** The invoice being reversed. */
  invoiceId: string;
  reason: string;
  /**
   * Which lines, and how many of each. Omit to reverse the whole invoice.
   * Keyed by the line's index on the original, so a partial credit cannot
   * invent a line that was never sold.
   */
  lines?: { index: number; quantity: number }[];
  issuedAt?: Date;
}

/** One line of the original, reversed: which line, and how many. */
export interface CreditPick {
  index: number;
  quantity: number;
}

/**
 * Work out what this credit note actually reverses.
 *
 * Pure, and the reason it is pure is that every rule worth getting right lives
 * here: an over-credit is not a display bug, it is a smaller GST liability on
 * a filed return, and that is the direction nobody audits.
 *
 * Three things it will not allow:
 *
 * 1. Crediting more of a line than was invoiced.
 * 2. Naming the same line twice to get around (1). The quantities are summed
 *    per line BEFORE the check, so two picks of five against a line of five is
 *    one pick of ten and is refused.
 * 3. Crediting what an earlier credit note already took. `alreadyCredited`
 *    comes from the notes already raised against this invoice; the headroom is
 *    what was invoiced less what has gone.
 *
 * With no lines named it reverses the whole invoice — meaning the REMAINING
 * quantity of every line, not the original quantity, so "credit the rest"
 * after a partial credit is one action rather than arithmetic done by hand.
 */
export function resolveCreditPicks(
  originalLines: { quantity: number }[],
  requested: CreditPick[] | undefined,
  alreadyCredited: Map<number, number> = new Map(),
): CreditPick[] {
  const headroom = (index: number) =>
    (originalLines[index]?.quantity ?? 0) - (alreadyCredited.get(index) ?? 0);

  if (!requested || requested.length === 0) {
    const whole = originalLines
      .map((_, index) => ({ index, quantity: headroom(index) }))
      .filter((pick) => pick.quantity > 0);
    if (whole.length === 0) {
      throw new InvoiceError("This invoice has already been credited in full.");
    }
    return whole;
  }

  // Summed per line first, so naming a line twice cannot slip past the check.
  const merged = new Map<number, number>();
  for (const pick of requested) {
    if (!originalLines[pick.index]) {
      throw new InvoiceError(`Line ${pick.index + 1} is not on that invoice.`);
    }
    if (!Number.isInteger(pick.quantity) || pick.quantity <= 0) {
      throw new InvoiceError(
        `Line ${pick.index + 1}: credit quantity must be a whole number above zero.`,
      );
    }
    merged.set(pick.index, (merged.get(pick.index) ?? 0) + pick.quantity);
  }

  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, quantity]) => {
      const left = headroom(index);
      if (quantity > left) {
        const invoiced = originalLines[index].quantity;
        throw new InvoiceError(
          left === invoiced
            ? `Line ${index + 1}: cannot credit ${quantity} when only ${invoiced} were invoiced.`
            : `Line ${index + 1}: only ${left} of ${invoiced} are left to credit — the rest already has been.`,
        );
      }
      return { index, quantity };
    });
}

/**
 * How much of each line the credit notes already raised against this invoice
 * have taken. Cancelled notes do not count — they took nothing.
 */
async function creditedSoFar(invoiceId: string): Promise<Map<number, number>> {
  const notes = await Invoice.find({
    againstInvoiceId: invoiceId,
    documentType: "credit_note",
    status: "issued",
  })
    .select("lines.againstLineIndex lines.quantity")
    .lean();

  const taken = new Map<number, number>();
  for (const note of notes) {
    for (const line of note.lines ?? []) {
      const index = line.againstLineIndex;
      if (typeof index !== "number") continue;
      // Stored negative; what was taken is the magnitude.
      taken.set(index, (taken.get(index) ?? 0) + Math.abs(line.quantity ?? 0));
    }
  }
  return taken;
}

/**
 * Raise a credit note against an issued invoice.
 *
 * The correction mechanism the plan always specified. Cancelling voids a whole
 * invoice; a credit note reverses part of one — a short delivery, a returned
 * canister, a price agreed down after the fact — and leaves the original
 * standing, which is what a filed document has to do.
 *
 * The lines are the ORIGINAL's lines with negated quantities. Nothing is
 * re-priced and no rate is re-read: reversing a sale at today's rate rather
 * than the rate it was sold at would be a different transaction. That is the
 * same snapshot rule the invoice itself lives by, applied backwards.
 */
export async function issueCreditNote(
  request: CreditNoteRequest,
  actor: string,
): Promise<HydratedDocument<InvoiceDoc>> {
  await connectToDatabase();

  const original = await Invoice.findById(request.invoiceId).lean();
  if (!original) throw new InvoiceError("That invoice does not exist.");
  if (original.documentType === "credit_note") {
    throw new InvoiceError("You cannot credit a credit note.");
  }
  if (original.documentType === "sample_note") {
    throw new InvoiceError("A sample note charged nothing, so there is nothing to credit. Cancel it if the sample came back.");
  }
  if (original.status !== "issued") {
    throw new InvoiceError(
      original.status === "cancelled"
        ? "That invoice is cancelled. There is nothing left to credit."
        : "Only an issued invoice can be credited.",
    );
  }
  if (original.isHistorical) {
    throw new InvoiceError(
      "That invoice was filed before this system. Credit it the way it was filed.",
    );
  }
  if (!request.reason.trim()) {
    throw new InvoiceError("A credit note needs a reason — it is printed on it.");
  }

  const originalLines = original.lines ?? [];
  const alreadyCredited = await creditedSoFar(String(original._id));
  const picks = resolveCreditPicks(originalLines, request.lines, alreadyCredited);

  const taxInput: InvoiceLineInput[] = picks.map((pick) => {
    const line = originalLines[pick.index];
    return {
      description: line.description,
      hsn: line.hsn,
      // NEGATIVE. See the documentType comment on the model.
      quantity: -pick.quantity,
      unitPricePaise: line.unitPricePaise,
      // The line's discount comes back with it, pro rata — see creditDiscount().
      discountPaise: -creditDiscount(
        line.discountPaise ?? 0,
        line.quantity,
        alreadyCredited.get(pick.index) ?? 0,
        pick.quantity,
      ),
      // The rate as it was SOLD at, never as it is today.
      gstRateBps: line.gstRateBps,
    };
  });

  const computed = computeInvoice(taxInput, original.supplyType ?? "intra");
  const issuedAt = request.issuedAt ?? new Date();
  const allocated = await allocateCreditNoteNumber(issuedAt);

  const note = await Invoice.create({
    documentType: "credit_note",
    againstInvoiceId: original._id,
    againstNumber: original.number,
    reason: request.reason.trim(),
    number: allocated.number,
    financialYear: allocated.financialYear,
    status: "issued",
    issuedAt,
    contactId: original.contactId,
    // The party as it was on the original, not as the contact reads today.
    party: original.party,
    // And the seller as it was — an original issued before the snapshot
    // existed takes today's, which is what it was printed from anyway.
    seller: original.seller ?? (await getSeller()),
    placeOfSupplyStateCode: original.placeOfSupplyStateCode,
    supplyType: original.supplyType,
    lines: computed.lines.map((line, i) => ({
      productId: originalLines[picks[i].index]?.productId ?? null,
      // The same shelf the original took them off, so they go back there.
      stockItemId: originalLines[picks[i].index]?.stockItemId ?? null,
      againstLineIndex: picks[i].index,
      description: line.description,
      packLabel: originalLines[picks[i].index]?.packLabel ?? "",
      hsn: line.hsn,
      // Pieces. A box order is credited by the piece — "3 boxes" on the
      // original, 30 pieces on the note, so a part-credit of a box is possible.
      quantity: line.quantity,
      uom: "piece",
      unitPricePaise: line.unitPricePaise,
      discountPaise: line.discountPaise ?? 0,
      discountType: originalLines[picks[i].index]?.discountType ?? "flat",
      discountValue: originalLines[picks[i].index]?.discountValue ?? 0,
      schemeId: originalLines[picks[i].index]?.schemeId ?? null,
      schemeName: originalLines[picks[i].index]?.schemeName ?? "",
      gstRateBps: line.gstRateBps,
      taxableValuePaise: line.taxableValuePaise,
      cgstPaise: line.cgstPaise,
      sgstPaise: line.sgstPaise,
      igstPaise: line.igstPaise,
      lineTotalPaise: line.lineTotalPaise,
    })),
    subtotalPaise: computed.subtotalPaise,
    cgstPaise: computed.cgstPaise,
    sgstPaise: computed.sgstPaise,
    igstPaise: computed.igstPaise,
    totalTaxPaise: computed.totalTaxPaise,
    roundOffPaise: computed.roundOffPaise,
    grandTotalPaise: computed.grandTotalPaise,
    amountInWords: computed.amountInWords,
    /*
      A credit note is not "unpaid". It reduces what is owed, and leaving it
      unpaid would put a negative row in the outstanding list forever.
    */
    payment: { status: "paid", paidPaise: computed.grandTotalPaise, referenceNo: "", paidAt: issuedAt },
    isSample: Boolean(original.isSample),
    createdBy: actor,
  });

  await recordAudit({
    actor,
    action: "credit",
    entity: "Invoice",
    entityId: String(note._id),
    after: {
      number: note.number,
      against: original.number,
      grandTotalPaise: note.grandTotalPaise,
      reason: note.reason,
    },
    note: `credits ${original.number}`,
  });

  // Money back to the customer: their lifetime revenue comes down by it.
  await applyTradingDelta(note.contactId, tradingDelta(note, "apply"));

  // And the goods back on the shelf, for the lines that came off one.
  const returned = movesFromLines(note.lines ?? []);
  if (returned.length > 0) {
    await restoreStock(returned, { note: `returned — ${note.number} credits ${original.number}`, actor });
  }

  return note;
}
