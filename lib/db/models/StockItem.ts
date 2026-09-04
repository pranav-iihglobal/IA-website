import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * What is on the shelf — finished goods and packaging alike.
 *
 * One collection for both, because the question asked of them is identical:
 * how many are left, and is that below the point where somebody should order
 * more. A sachet with no label is as unsellable as no sachet.
 *
 * `onHand` is PERPETUAL for an item linked to a product pack: an issued
 * invoice takes pieces off it, a credit note or a cancellation puts them
 * back, and a line asking for more than is on hand is refused before any
 * number is allocated (lib/erp/stock-moves.ts). It is still a COUNT first —
 * saving the form records what somebody actually saw and overrides the book,
 * because stock moves for reasons no document records: a bag split in
 * transit, a recount that found six more. An unlinked item is a count and
 * nothing else, which is what packaging and raw material want.
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

    /**
     * The product pack this item IS, when it is one. Set on finished goods
     * so a sale moves the count; null on packaging and raw material, and on
     * a finished good nobody has linked yet. One item per pack — see the
     * partial unique index below.
     */
    productId: { type: Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    packLabel: { type: String, default: "", trim: true },

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
/**
 * One shelf per pack. Two items linked to the same pack would each be
 * deducted for the same sale, or neither would, depending on which one the
 * query found first. Partial, so the many unlinked items do not collide on
 * null.
 */
stockSchema.index(
  { productId: 1, packLabel: 1 },
  {
    unique: true,
    name: "one_item_per_pack",
    partialFilterExpression: { productId: { $type: "objectId" } },
  },
);

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
