import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A tax invoice.
 *
 * Two ideas hold this whole model up, and both are about the same thing:
 * an issued invoice is a RECORD OF WHAT WAS FILED, not a view onto current
 * data.
 *
 * 1. EVERY LINE IS A SNAPSHOT. Description, HSN, GST rate and unit price are
 *    COPIED onto the line at issue. They are not read from the product. The
 *    directors were promised an editable GST rate — so if a line read the
 *    rate live, changing FloraMax from 5% to 12% next year would silently
 *    rewrite every invoice already submitted to the GST department. The same
 *    goes for the party: a customer moving village must not alter last year's
 *    document. `productId` and `contactId` survive for reporting and linking
 *    only, and nothing financial is ever read through them.
 *
 * 2. TOTALS ARE STORED, NOT RECOMPUTED. computeInvoice() runs once, at issue,
 *    and the answer is written down. Reading an invoice never recalculates
 *    it. A rounding fix shipped in 2027 must not change what a 2025 invoice
 *    says.
 *
 * Both are enforced below by a pre-save hook rather than left to the UI,
 * because the UI is not the only writer — the historical import and any
 * future script go through this model too.
 */

/**
 * Who the invoice was made out to, as it read on the day.
 *
 * A copy, deliberately. The live contact record is at `contactId` for
 * linking; nothing here is refreshed from it.
 */
const partySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    businessName: { type: String, default: "", trim: true },
    /** Present for a B2B sale; its absence is what makes a sale B2CS. */
    gstin: { type: String, default: "", trim: true, uppercase: true },
    phone: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    village: { type: String, default: "", trim: true },
    district: { type: String, default: "", trim: true },
    pin: { type: String, default: "", trim: true },
    state: { type: String, default: "Gujarat", trim: true },
  },
  { _id: false },
);

/**
 * Who SOLD it, as it read on the day — the other half of the party rule.
 *
 * IKSARVA's GSTIN and bank details live in Settings and can be changed by an
 * owner. A bank account changed in October must not appear on a September
 * invoice reprinted in November, so the print page reads THIS copy and never
 * the setting. Null on an invoice issued before the copy existed; those were
 * printed from the constant in lib/content.ts, which is what they still say
 * (see sellerFrom() in lib/erp/seller.ts).
 */
const sellerSchema = new Schema(
  {
    gstin: { type: String, default: "", trim: true, uppercase: true },
    pan: { type: String, default: "", trim: true, uppercase: true },
    stateCode: { type: String, default: "", trim: true },
    bank: {
      accountName: { type: String, default: "", trim: true },
      name: { type: String, default: "", trim: true },
      accountNo: { type: String, default: "", trim: true },
      ifsc: { type: String, default: "", trim: true, uppercase: true },
      upi: { type: String, default: "", trim: true, lowercase: true },
    },
  },
  { _id: false },
);

const lineSchema = new Schema(
  {
    /** Reporting only. Never read for a price, a rate or an HSN code. */
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    /**
     * The stock item this line came off, when its pack was linked at issue.
     * Written once, here, because lines are frozen after; a cancellation or a
     * credit note reads it to put the pieces back on the same shelf even if
     * the link has since been moved. Null when nothing moved.
     */
    stockItemId: { type: Schema.Types.ObjectId, ref: "StockItem", default: null },

    /**
     * Credit note lines only: which line of the ORIGINAL invoice this reverses,
     * by its position.
     *
     * Recorded because a second credit note has to know what the first one
     * already took. Without it, crediting the same line twice is invisible and
     * the month's liability is understated on a filed return. Null on an
     * invoice line, which reverses nothing.
     */
    againstLineIndex: { type: Number, default: null },

    // ---- the snapshot ----
    description: { type: String, required: true, trim: true },
    /** The pack, e.g. "25g sachet", as it was named at the time. */
    packLabel: { type: String, default: "", trim: true },
    hsn: { type: String, default: "", trim: true },
    /** PIECES, always — tax, HSN, credits and stock all count pieces. */
    quantity: { type: Number, required: true },
    /** How it was ordered: "box" when a dealer bought N boxes of unitsPerBox. */
    uom: { type: String, enum: ["piece", "box"], default: "piece" },
    boxes: { type: Number, default: 0 },
    unitsPerBox: { type: Number, default: 0 },
    /** Integer paise, before tax and before any discount. */
    unitPricePaise: { type: Number, required: true },
    /** The resolved discount in paise — what the taxable value was reduced by. */
    discountPaise: { type: Number, default: 0 },
    /** How it was stated: flat paise, or percent in basis points. For the print. */
    discountType: { type: String, enum: ["flat", "percent"], default: "flat" },
    discountValue: { type: Number, default: 0 },
    /**
     * The seasonal scheme that supplied the discount, when nothing was typed.
     * Named as well as referenced, because the print says "Kharif 10%" and
     * the scheme may be renamed or deleted long after.
     */
    schemeId: { type: Schema.Types.ObjectId, ref: "Scheme", default: null },
    schemeName: { type: String, default: "", trim: true },
    /** Basis points: 500 is 5%. Copied from the product AT ISSUE. */
    gstRateBps: { type: Number, required: true, min: 0, max: 10_000 },

    // ---- what computeInvoice() worked out, written down ----
    taxableValuePaise: { type: Number, required: true },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    lineTotalPaise: { type: Number, required: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    /**
     * Which kind of document this is.
     *
     * A credit note lives in this collection rather than its own, because it
     * IS an invoice structurally — a party snapshot, snapshotted lines, tax
     * computed once, totals written down — and because every report has to
     * see both. A second model would duplicate all of that and then need
     * every query written twice.
     *
     * Its AMOUNTS ARE NEGATIVE. That is the whole trick: outstanding,
     * lifetime revenue, the dashboard and the customer profile all just sum,
     * and a credit note reduces them without a single special case. Storing
     * positives and subtracting by type would work until somebody added the
     * ninth aggregation and forgot. computeInvoice() was already built and
     * tested for this — negating an invoice's quantities cancels it to
     * exactly zero.
     *
     * The print view shows absolute values, because a printed credit note
     * reads "₹1,050", not "−₹1,050".
     */
    documentType: {
      type: String,
      enum: ["invoice", "credit_note"],
      default: "invoice",
      required: true,
      index: true,
    },
    /** The invoice this reverses. Required on a credit note. */
    againstInvoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", default: null },
    /** Its number, snapshotted — the original must be nameable even if edited. */
    againstNumber: { type: String, default: "", trim: true },
    /** Why it was raised. Printed, and required by the GST return. */
    reason: { type: String, default: "", trim: true },

    /**
     * IA.MM.YY.NNN for an invoice, CN.MM.YY.NNN for a credit note. Absent on a
     * draft: the number is allocated at ISSUE, so an abandoned draft cannot
     * leave a gap in a GST series.
     */
    number: { type: String, default: "", trim: true, index: true },
    /** April–March, e.g. "25-26". What the CA files by. */
    financialYear: { type: String, default: "", trim: true, index: true },

    status: {
      type: String,
      enum: ["draft", "issued", "cancelled"],
      default: "draft",
      required: true,
      index: true,
    },
    issuedAt: { type: Date, default: null },
    /** Kept, with the number, so a cancellation is legible rather than a hole. */
    cancelledAt: { type: Date, default: null },
    cancelledReason: { type: String, default: "", trim: true },

    contactId: { type: Schema.Types.ObjectId, ref: "Contact", default: null },
    party: { type: partySchema, required: true },
    /** Frozen with the rest: a seller change after issue is a different document. */
    seller: { type: sellerSchema, default: null },

    /**
     * A STATE CODE — 24 for Gujarat — not a PIN.
     *
     * Their GST_Filing_Export currently carries a pin (363310) in this
     * position, where GSTR-1 expects the state. It decides CGST+SGST versus
     * IGST, so it is not a display field.
     */
    placeOfSupplyStateCode: { type: String, default: "24", trim: true },
    supplyType: { type: String, enum: ["intra", "inter"], default: "intra" },

    lines: { type: [lineSchema], default: [] },

    // ---- totals, computed once ----
    subtotalPaise: { type: Number, default: 0 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    totalTaxPaise: { type: Number, default: 0 },
    roundOffPaise: { type: Number, default: 0 },
    grandTotalPaise: { type: Number, default: 0 },
    /** Derived from grandTotalPaise at issue, so the two cannot disagree. */
    amountInWords: { type: String, default: "", trim: true },

    /*
      There is no transport field here, deliberately.

      Their sheets carried "Transport Cost" and "Transport Charged?" per line,
      but across 54 invoices the second was never once yes — and the directors
      confirmed freight comes out of their own pockets rather than the
      company's. So it is neither charged to the customer nor a company cost,
      and it has no business on a tax invoice.

      Where it DOES belong is a purchase marked paid by a director, which
      records it as a cost the company owes back. See lib/db/models/Purchase.
    */

    /**
     * The one part that legitimately changes after issue — money arrives
     * later. Excluded from the immutability check below for exactly that
     * reason, and for no other.
     */
    payment: {
      status: {
        type: String,
        enum: ["unpaid", "partial", "paid"],
        default: "unpaid",
        index: true,
      },
      paidPaise: { type: Number, default: 0 },
      referenceNo: { type: String, default: "", trim: true },
      paidAt: { type: Date, default: null },
    },

    /**
     * One of the 53 already filed, imported exactly as recorded.
     *
     * Never recomputed, never edited, never cancelled. Where an imported
     * figure does not tie, it is reported and left alone — silently
     * correcting it would misrepresent what was actually filed.
     */
    isHistorical: { type: Boolean, default: false, index: true },

    /**
     * Seeded test data, not a real sale.
     *
     * Sample invoices take their numbers from a SEPARATE series with its own
     * prefix (see lib/erp/invoice-number.ts). Sharing the real counter would
     * mean wiping them left permanent gaps in an issued GST sequence — the
     * exact property the atomic counter exists to guarantee.
     */
    isSample: { type: Boolean, default: false, index: true },

    notes: { type: String, default: "", trim: true },
    /** Email of whoever raised it, from the session. */
    createdBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

/** The list: newest first, and the CA's filter by year. */
invoiceSchema.index({ documentType: 1, status: 1, issuedAt: -1 });
invoiceSchema.index({ againstInvoiceId: 1 });
invoiceSchema.index({ financialYear: 1, issuedAt: -1 });
invoiceSchema.index({ contactId: 1, issuedAt: -1 });

/**
 * Fields that may still change once an invoice exists as a document of
 * record. Everything else is frozen.
 *
 * Money arriving is a fact about the world, not about the invoice, so it does
 * not alter what was filed. A note does not either. Nothing else qualifies.
 */
const MUTABLE_AFTER_ISSUE = new Set([
  "payment",
  "payment.status",
  "payment.paidPaise",
  "payment.referenceNo",
  "payment.paidAt",
  "notes",
  "cancelledAt",
  "cancelledReason",
  "updatedAt",
]);

/*
  `status` is NOT in that set, and its absence is the point.

  It used to be, and that was a hole straight through the lock: `frozen` is
  worked out from the status being saved, so setting an issued invoice back to
  "draft" made the hook see a draft, permit it, and save. The document was then
  genuinely a draft, and every line, total and party edit was allowed. One
  field, and the guarantee this whole model exists to provide was gone.

  So status is handled separately below, against the status the document had
  when it was LOADED, and exactly one transition out of a frozen state is
  allowed: to "cancelled".
*/

/**
 * The lock.
 *
 * In the model rather than the route, because the route is not the only
 * writer: the historical import writes here, and so will anything added
 * later. A rule that only exists in one caller is a rule that is one new
 * caller away from being gone.
 *
 * Note this catches document saves. A raw `updateOne` on the collection
 * bypasses every Mongoose hook — which is exactly how the migration script
 * has to work — so the application code must always go through a document.
 */
/**
 * Which of these changes an invoice in this state must refuse.
 *
 * Pulled out of the hook and exported so it can be run without a database.
 * The last time a rule in this codebase lived somewhere untestable it was the
 * CRM search, and it shipped broken — a lock nobody can exercise is a lock
 * nobody knows is open.
 */
export function illegalChanges(
  modifiedPaths: string[],
  /** The state being SAVED. */
  state: { isHistorical?: boolean; status?: string },
  /**
   * The status the document had when it was loaded.
   *
   * Defaults to the state being saved, which is right for a document whose
   * status is not changing. Whether an invoice is frozen is a fact about what
   * it WAS, never about what someone is trying to make it.
   */
  previousStatus: string = state.status ?? "draft",
): string[] {
  const frozen = Boolean(state.isHistorical) || previousStatus !== "draft";
  if (!frozen) return [];

  return modifiedPaths.filter((path) => {
    if (path === "status") {
      /*
        The one way out of a frozen state. A historical invoice has none —
        those were filed and are not ours to cancel.
      */
      return Boolean(state.isHistorical) || state.status !== "cancelled";
    }
    return !MUTABLE_AFTER_ISSUE.has(path) && !path.startsWith("payment.");
  });
}

/**
 * Remember what the document was, so the hook can tell.
 *
 * `this.status` in a pre-save hook is the NEW value; without this there is no
 * way to know an issued invoice is being turned into a draft.
 */
invoiceSchema.post("init", function () {
  this.$locals.previousStatus = this.status;
});

invoiceSchema.pre("save", function () {
  if (this.isNew) return;

  const illegal = illegalChanges(
    this.modifiedPaths(),
    { isHistorical: this.isHistorical, status: this.status },
    (this.$locals.previousStatus as string | undefined) ?? this.status,
  );
  if (illegal.length === 0) return;

  // Thrown, not passed to next(): a zero-argument hook is treated as
  // synchronous by Mongoose, and a throw becomes the save's rejection.
  throw new Error(
    `${this.isHistorical ? "A historical" : "An issued"} invoice cannot be ` +
      `changed (${illegal.join(", ")}). Cancel it and raise a new one.`,
  );
});

export type InvoiceDoc = InferSchemaType<typeof invoiceSchema>;

export const Invoice: Model<InvoiceDoc> =
  (models.Invoice as Model<InvoiceDoc>) ??
  model<InvoiceDoc>("Invoice", invoiceSchema);
