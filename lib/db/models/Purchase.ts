import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * What IKSARVA bought, and the GST paid on it.
 *
 * The mirror of an invoice, and much simpler: this is a record of somebody
 * else's document, so nothing here is computed — the totals are transcribed
 * from the supplier's bill exactly as printed. If their arithmetic disagrees
 * with ours, theirs is the one that was filed, and re-deriving it would
 * misrepresent the document.
 *
 * That is why there is no computeInvoice() here. It is not an oversight.
 */

export const PURCHASE_CATEGORIES = [
  "raw_material",
  "packaging",
  "job_work",
  "freight",
  "marketing",
  "services",
  "other",
] as const;

const purchaseSchema = new Schema(
  {
    supplier: { type: String, required: true, trim: true },
    /** Their GSTIN. Its absence means no input credit can be claimed. */
    supplierGstin: { type: String, default: "", trim: true, uppercase: true },
    /** THEIR invoice number, not ours. */
    billNo: { type: String, default: "", trim: true, index: true },
    billDate: { type: Date, default: null, index: true },

    category: {
      type: String,
      enum: PURCHASE_CATEGORIES,
      default: "other",
      index: true,
    },
    description: { type: String, default: "", trim: true },

    /* Transcribed from the supplier's bill. Integer paise. */
    taxableValuePaise: { type: Number, default: 0 },
    cgstPaise: { type: Number, default: 0 },
    sgstPaise: { type: Number, default: 0 },
    igstPaise: { type: Number, default: 0 },
    totalPaise: { type: Number, default: 0 },

    /**
     * Whether the GST on this is claimable as input credit.
     *
     * Not every purchase is — and it is a judgement the CA makes, not one to
     * infer from the category. Defaults to true where a GSTIN is present,
     * and stays editable.
     */
    inputCreditEligible: { type: Boolean, default: true },

    /**
     * Whose money actually left.
     *
     * The directors pay some costs — freight, most obviously — out of their
     * own pockets. Recording those as ordinary purchases would show company
     * money going out that never did; recording them nowhere makes the cost
     * base look better than it is and quietly loses what the company owes
     * back. Neither is acceptable, so the flag exists.
     *
     * This is NOT a ledger and never becomes one. It records the fact; the CA
     * decides what to do with it.
     */
    paidBy: {
      type: String,
      enum: ["company", "director"],
      default: "company",
      required: true,
      index: true,
    },
    /** Which director, where it matters. Free text — there are two of them. */
    paidByName: { type: String, default: "", trim: true },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partial", "paid"],
      default: "unpaid",
      index: true,
    },
    paidPaise: { type: Number, default: 0 },
    notes: { type: String, default: "", trim: true },

    isSample: { type: Boolean, default: false, index: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

purchaseSchema.index({ billDate: -1 });
purchaseSchema.index({ supplier: 1, billDate: -1 });

export type PurchaseDoc = InferSchemaType<typeof purchaseSchema>;

export const Purchase: Model<PurchaseDoc> =
  (models.Purchase as Model<PurchaseDoc>) ??
  model<PurchaseDoc>("Purchase", purchaseSchema);
