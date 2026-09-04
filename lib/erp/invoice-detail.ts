import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * One invoice, and everything that has happened to it.
 *
 * The list showed a number, a party and a total; the print view showed the
 * document. Neither could answer the questions that come up about an invoice
 * that has been out for a while:
 *
 *   "How much of this have we already credited?" — the ceiling is computed
 *   inside issueCreditNote() and thrown away, so the only way to find out was
 *   to open the credit form and read the defaults.
 *
 *   "Which credit notes are against it?" — stored as `againstInvoiceId` and
 *   read by nothing.
 *
 *   "What is actually still owed?" — grandTotal minus paid minus credits, and
 *   only the first two were on screen anywhere.
 *
 * All of it is derived here rather than stored, for the same reason the
 * trading figures on a customer profile are: a stored total is wrong the
 * moment a credit note is raised, and nobody notices it happen.
 */

export interface DetailLine {
  description: string;
  packLabel: string;
  hsn: string;
  quantity: number;
  unitPricePaise: number;
  discountPaise: number;
  /** How it was stated — "10%" reads better than the paise it came to. */
  discountType: "flat" | "percent";
  discountValue: number;
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
  /** How much of this line earlier credit notes have already reversed. */
  creditedQuantity: number;
  /** What is left to credit. Zero once the line is fully reversed. */
  creditableQuantity: number;
}

export interface RelatedNote {
  id: string;
  number: string;
  issuedAt: string | null;
  status: string;
  reason: string;
  grandTotalPaise: number;
}

export interface InvoiceDetail {
  id: string;
  number: string;
  documentType: string;
  /** On a credit note, the invoice it reverses. */
  againstNumber: string;
  againstInvoiceId: string | null;
  reason: string;
  financialYear: string;
  status: string;
  issuedAt: string | null;
  isHistorical: boolean;
  isSample: boolean;
  notes: string;

  party: {
    name: string;
    businessName: string;
    gstin: string;
    phone: string;
    address: string;
    village: string;
    district: string;
    pin: string;
    state: string;
  };
  contactId: string | null;
  placeOfSupplyStateCode: string;
  supplyType: string;

  lines: DetailLine[];
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  amountInWords: string;

  payment: {
    status: string;
    paidPaise: number;
    referenceNo: string;
    paidAt: string | null;
  };

  /** Credit notes raised against this invoice, newest first. */
  creditNotes: RelatedNote[];
  /** Their combined value, as a positive figure. */
  creditedPaise: number;
  /**
   * What is genuinely still owed: invoiced, less what was received, less what
   * has been credited back. Never negative — an overpayment is credit, not a
   * debt, and "owes −₹12" reads as a bug.
   */
  owedPaise: number;
  /** True when at least one line still has something left to credit. */
  creditable: boolean;
}

/** Sum by line index of what earlier credit notes already took. */
async function creditedByLine(invoiceId: string): Promise<Map<number, number>> {
  const notes = await Invoice.find({
    againstInvoiceId: invoiceId,
    documentType: "credit_note",
    status: "issued",
  })
    .select("lines.againstLineIndex lines.quantity")
    .lean();

  const taken = new Map<number, number>();
  for (const note of notes as LeanDoc[]) {
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
 * How much issued credit notes have taken off one invoice, as a positive
 * figure. What the payment form needs to prefill "the rest" correctly.
 */
export async function creditedPaiseAgainst(invoiceId: string): Promise<number> {
  await connectToDatabase();
  const [row] = await Invoice.aggregate<{ total: number }>([
    { $match: { againstInvoiceId: new Types.ObjectId(invoiceId), documentType: "credit_note", status: "issued" } },
    { $group: { _id: null, total: { $sum: { $abs: "$grandTotalPaise" } } } },
  ]);
  return row?.total ?? 0;
}

export async function getInvoiceDetail(id: string): Promise<InvoiceDetail | null> {
  await connectToDatabase();

  const doc = (await Invoice.findById(id).lean()) as LeanDoc | null;
  if (!doc) return null;

  const isCredit = doc.documentType === "credit_note";

  /*
    A credit note cannot itself be credited, so it has no ceiling to work out
    and no notes of its own. Skipping both queries is not an optimisation — it
    is what stops the page implying either is possible.
  */
  const [taken, notes] = isCredit
    ? [new Map<number, number>(), [] as LeanDoc[]]
    : await Promise.all([
        creditedByLine(id),
        Invoice.find({
          againstInvoiceId: id,
          documentType: "credit_note",
        })
          .select("number issuedAt status reason grandTotalPaise")
          .sort({ issuedAt: -1 })
          .lean() as Promise<LeanDoc[]>,
      ]);

  const lines: DetailLine[] = (doc.lines ?? []).map((l: LeanDoc, index: number) => {
    const quantity = l.quantity ?? 0;
    const credited = taken.get(index) ?? 0;
    return {
      description: l.description ?? "",
      packLabel: l.packLabel ?? "",
      hsn: l.hsn ?? "",
      quantity,
      unitPricePaise: l.unitPricePaise ?? 0,
      discountPaise: l.discountPaise ?? 0,
      discountType: l.discountType === "percent" ? "percent" : "flat",
      discountValue: l.discountValue ?? 0,
      gstRateBps: l.gstRateBps ?? 0,
      taxableValuePaise: l.taxableValuePaise ?? 0,
      cgstPaise: l.cgstPaise ?? 0,
      sgstPaise: l.sgstPaise ?? 0,
      igstPaise: l.igstPaise ?? 0,
      lineTotalPaise: l.lineTotalPaise ?? 0,
      creditedQuantity: credited,
      creditableQuantity: Math.max(0, quantity - credited),
    };
  });

  const issuedNotes = (notes as LeanDoc[]).filter((n) => n.status === "issued");
  // Stored negative, so the magnitude is what came off the invoice.
  const creditedPaise = issuedNotes.reduce(
    (total, n) => total + Math.abs(n.grandTotalPaise ?? 0),
    0,
  );
  const grandTotalPaise = doc.grandTotalPaise ?? 0;
  const paidPaise = doc.payment?.paidPaise ?? 0;

  return {
    id: String(doc._id),
    number: doc.number ?? "",
    documentType: doc.documentType ?? "invoice",
    againstNumber: doc.againstNumber ?? "",
    againstInvoiceId: doc.againstInvoiceId ? String(doc.againstInvoiceId) : null,
    reason: doc.reason ?? "",
    financialYear: doc.financialYear ?? "",
    status: doc.status ?? "draft",
    issuedAt: doc.issuedAt ? new Date(doc.issuedAt).toISOString() : null,
    isHistorical: Boolean(doc.isHistorical),
    isSample: Boolean(doc.isSample),
    notes: doc.notes ?? "",

    party: {
      name: doc.party?.name ?? "",
      businessName: doc.party?.businessName ?? "",
      gstin: doc.party?.gstin ?? "",
      phone: doc.party?.phone ?? "",
      address: doc.party?.address ?? "",
      village: doc.party?.village ?? "",
      district: doc.party?.district ?? "",
      pin: doc.party?.pin ?? "",
      state: doc.party?.state ?? "",
    },
    contactId: doc.contactId ? String(doc.contactId) : null,
    placeOfSupplyStateCode: doc.placeOfSupplyStateCode ?? "24",
    supplyType: doc.supplyType ?? "intra",

    lines,
    subtotalPaise: doc.subtotalPaise ?? 0,
    cgstPaise: doc.cgstPaise ?? 0,
    sgstPaise: doc.sgstPaise ?? 0,
    igstPaise: doc.igstPaise ?? 0,
    roundOffPaise: doc.roundOffPaise ?? 0,
    grandTotalPaise,
    amountInWords: doc.amountInWords ?? "",

    payment: {
      status: doc.payment?.status ?? "unpaid",
      paidPaise,
      referenceNo: doc.payment?.referenceNo ?? "",
      paidAt: doc.payment?.paidAt
        ? new Date(doc.payment.paidAt).toISOString()
        : null,
    },

    creditNotes: (notes as LeanDoc[]).map((n) => ({
      id: String(n._id),
      number: n.number ?? "",
      issuedAt: n.issuedAt ? new Date(n.issuedAt).toISOString() : null,
      status: n.status ?? "issued",
      reason: n.reason ?? "",
      grandTotalPaise: n.grandTotalPaise ?? 0,
    })),
    creditedPaise,
    owedPaise: Math.max(0, grandTotalPaise - paidPaise - creditedPaise),
    creditable: lines.some((l) => l.creditableQuantity > 0),
  };
}
