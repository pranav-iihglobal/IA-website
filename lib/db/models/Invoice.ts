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

const lineSchema = new Schema(
  {
    /** Reporting only. Never read for a price, a rate or an HSN code. */
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null },

    // ---- the snapshot ----
    description: { type: String, required: true, trim: true },
    /** The pack, e.g. "25g sachet", as it was named at the time. */
    packLabel: { type: String, default: "", trim: true },
    hsn: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true },
    /** Integer paise, before tax and before any discount. */
    unitPricePaise: { type: Number, required: true },
    discountPaise: { type: Number, default: 0 },
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
     * IA.MM.YY.NNN. Absent on a draft: the number is allocated at ISSUE, so
     * an abandoned draft cannot leave a gap in a GST series.
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

    /** Per-invoice, already in use on their sheets. */
    transportPaise: { type: Number, default: 0 },
    transportCharged: { type: Boolean, default: false },

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

    notes: { type: String, default: "", trim: true },
    /** Email of whoever raised it, from the session. */
    createdBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

/** The list: newest first, and the CA's filter by year. */
invoiceSchema.index({ status: 1, issuedAt: -1 });
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
  "status",
  "cancelledAt",
  "cancelledReason",
  "updatedAt",
]);

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
  state: { isHistorical?: boolean; status?: string },
): string[] {
  const frozen = Boolean(state.isHistorical) || state.status !== "draft";
  if (!frozen) return [];
  return modifiedPaths.filter(
    (path) => !MUTABLE_AFTER_ISSUE.has(path) && !path.startsWith("payment."),
  );
}

invoiceSchema.pre("save", function () {
  if (this.isNew) return;

  const illegal = illegalChanges(this.modifiedPaths(), {
    isHistorical: this.isHistorical,
    status: this.status,
  });
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
