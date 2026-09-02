import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * What is on the shelf — finished goods and packaging alike.
 *
 * One collection for both, because the question asked of them is identical:
 * how many are left, and is that below the point where somebody should order
 * more. A sachet with no label is as unsellable as no sachet.
 *
 * `onHand` is a COUNT, deliberately not derived from invoices. Stock moves for
 * reasons no invoice records — a sample handed to a farmer, a bag split in
 * transit, a recount that found six more than the book said. Deriving it would
 * make the app's number confidently wrong; a counted number that someone
 * updates is honestly approximate, which is what stock actually is.
 */

export const STOCK_KINDS = ["finished", "packaging", "raw"] as const;

const stockSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Their SKU where it has one, e.g. IKS-FLM-025. */
    sku: { type: String, default: "", trim: true, index: true },
    kind: {
      type: String,
      enum: STOCK_KINDS,
      default: "finished",
      required: true,
      index: true,
    },
    /** "sachet", "bottle", "kg", "label" — whatever it is counted in. */
    unit: { type: String, default: "unit", trim: true },

    onHand: { type: Number, default: 0 },
    /**
     * Order more at or below this. Zero means "no alert wanted" rather than
     * "alert always" — otherwise every item with an unset level would shout.
     */
    reorderLevel: { type: Number, default: 0 },

    /** What one unit costs to buy or make. Integer paise, as everywhere. */
    unitCostPaise: { type: Number, default: 0 },

    /** Who it is bought from — the record, and the name as a snapshot. */
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    supplier: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },

    /** Last time a human actually counted, as opposed to last time it saved. */
    countedAt: { type: Date, default: null },

    isSample: { type: Boolean, default: false, index: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

/** The list, and the "needs ordering" view. */
stockSchema.index({ kind: 1, name: 1 });

export type StockItemDoc = InferSchemaType<typeof stockSchema>;

export const StockItem: Model<StockItemDoc> =
  (models.StockItem as Model<StockItemDoc>) ??
  model<StockItemDoc>("StockItem", stockSchema);

/**
 * Is this item at or below its reorder point?
 *
 * A reorder level of zero means nobody set one, so it never alerts — the
 * alternative is every unconfigured item permanently shouting, which trains
 * people to ignore the whole column.
 */
export function needsReorder(item: {
  onHand?: number;
  reorderLevel?: number;
}): boolean {
  const level = item.reorderLevel ?? 0;
  if (level <= 0) return false;
  return (item.onHand ?? 0) <= level;
}
