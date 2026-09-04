import { connectToDatabase } from "@/lib/db/connect";
import type { HydratedDocument } from "mongoose";
import { Invoice, type InvoiceDoc } from "@/lib/db/models/Invoice";
import { Contact } from "@/lib/db/models/Contact";
import { recordAudit } from "@/lib/db/models/AuditLog";
import { getSeller } from "@/lib/admin/settings";
import { InvoiceError } from "./invoice-error";
import { snapshotLines } from "./invoice";
import type { Uom } from "./quantity";
import { allocateSampleNoteNumber } from "./invoice-number";
import { computeInvoice, GUJARAT_STATE_CODE } from "./tax";
import {
  assertNoShortage,
  deductStock,
  planStockMoves,
  restoreStock,
  shelfItemsFor,
} from "./stock-moves";

/**
 * Giving a sample.
 *
 * The sampling programme is how this business finds customers: a prospect is
 * handed a sachet, and weeks later either buys or does not. Until now that
 * hand-over was a note on the lead and nothing else — nothing moved stock,
 * nothing was numbered, and "how many sachets did we give away in Kharif" was
 * a guess. A SAMPLE NOTE is the document for it: the invoice engine's own
 * snapshot of who, what and how many, at a price of zero.
 *
 * What it is NOT: a tax invoice. Nothing was sold, so no GST is charged, no
 * IA number is consumed, and it never appears on the return — see
 * lib/erp/document-kind.ts. It DOES take the pieces off the shelf, the same
 * guarded way a sale does, and cancelling it puts them back.
 *
 * Open with the CA (recorded in the plan): whether the print should be titled
 * a delivery challan, and the input-credit position on inputs used for free
 * samples. Either changes a title or a series name, not this shape.
 */

export interface SampleLine {
  productId: string;
  packLabel: string;
  /** Pieces — or boxes when uom is "box". */
  quantity: number;
  uom?: Uom;
}

export interface SampleNoteRequest {
  contactId: string;
  lines: SampleLine[];
  notes?: string;
  issuedAt?: Date;
}

export async function issueSampleNote(
  request: SampleNoteRequest,
  actor: string,
): Promise<HydratedDocument<InvoiceDoc>> {
  await connectToDatabase();

  const contact = await Contact.findById(request.contactId)
    .select("name businessName phone village taluka district pin state dealer kind channel stage isSample")
    .lean();
  if (!contact) throw new InvoiceError("That person no longer exists.");
  /*
    Real people only. A demo contact can be wiped, and a real document
    pointing at a deleted person is exactly the trap the invoice picker
    guards against — the same rule, applied here by name because samples
    reach a wider list (leads too).
  */
  if (contact.isSample) throw new InvoiceError("That is a demo contact. Samples are recorded for real people only.");

  const issuedAt = request.issuedAt ?? new Date();

  /*
    The invoice engine's own snapshot, at ₹0 with no discount and no
    schemes. It still reads the rate and the HSN from the product — a
    product that could not be invoiced cannot be sampled either, which
    keeps the products list honest — and it still multiplies boxes out.
  */
  const snapshotted = await snapshotLines(
    request.lines.map((l) => ({
      productId: l.productId,
      packLabel: l.packLabel,
      quantity: l.quantity,
      uom: l.uom,
      unitPricePaise: 0,
    })),
    { schemes: [], channel: contact.channel ?? "", at: issuedAt },
  );

  // Stock first, refused per line, before any number is consumed — as a sale.
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

  await deductStock(moves, { note: "given as a sample — note being issued", actor });

  let allocated: Awaited<ReturnType<typeof allocateSampleNoteNumber>>;
  try {
    allocated = await allocateSampleNoteNumber(issuedAt);
  } catch (error) {
    await restoreStock(moves, { note: "returned — the sample note could not be numbered", actor });
    throw error;
  }

  // Every figure is zero; computeInvoice() says so in the same shape a sale has.
  const computed = computeInvoice(
    snapshotted.map((s) => s.tax),
    "intra",
  );
  const seller = await getSeller();

  let note: HydratedDocument<InvoiceDoc>;
  try {
    note = await Invoice.create({
      documentType: "sample_note",
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
      placeOfSupplyStateCode: GUJARAT_STATE_CODE,
      supplyType: "intra",
      lines: computed.lines.map((line, i) => ({
        productId: snapshotted[i].productId,
        stockItemId: itemForLine.get(i) ?? null,
        description: line.description,
        packLabel: snapshotted[i].packLabel,
        hsn: line.hsn,
        quantity: line.quantity,
        uom: snapshotted[i].uom,
        boxes: snapshotted[i].boxes,
        unitsPerBox: snapshotted[i].unitsPerBox,
        unitPricePaise: 0,
        discountPaise: 0,
        discountType: "flat",
        discountValue: 0,
        gstRateBps: line.gstRateBps,
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        lineTotalPaise: 0,
      })),
      subtotalPaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalTaxPaise: 0,
      roundOffPaise: 0,
      grandTotalPaise: 0,
      amountInWords: computed.amountInWords,
      // Nothing to collect: written settled so it can never appear as owed.
      payment: { status: "paid", paidPaise: 0, referenceNo: "", paidAt: issuedAt },
      notes: request.notes ?? "",
      createdBy: actor,
    });
  } catch (error) {
    await restoreStock(moves, { note: `returned — ${allocated.number} could not be written`, actor });
    throw error;
  }

  await recordAudit({
    actor,
    action: "issue",
    entity: "Invoice",
    entityId: String(note._id),
    after: {
      number: note.number,
      party: note.party.name,
      pieces: snapshotted.reduce((n, s) => n + s.tax.quantity, 0),
    },
    note: "sample note — no charge",
  });

  /*
    The lead's sampling record follows the document: the FIRST sample sets
    the date, and every sampled product is added to the set. What used to be
    typed by hand on the lead form is now written by the act itself — the
    form still allows a correction.
  */
  await Contact.updateOne(
    { _id: contact._id, "lead.sampleDate": null },
    { $set: { "lead.sampleDate": issuedAt } },
  );
  await Contact.updateOne(
    { _id: contact._id },
    { $addToSet: { "lead.productIds": { $each: snapshotted.map((s) => s.productId) } } },
  );

  return note;
}
