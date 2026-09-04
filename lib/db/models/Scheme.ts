import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A seasonal scheme: a discount that applies itself between two moments.
 *
 * Sowing seasons are the shape of this business, and a Kharif offer used to
 * be a discount somebody remembered to type on every invoice for six weeks —
 * and forgot on some, and typed on one in July. A scheme is the rule written
 * down once: what it takes off, for which packs, for which channel, from when
 * until when. The invoice engine reads the rules active AT ISSUE and applies
 * the best one to any line where nothing was typed; a typed discount always
 * wins, because the person on the spot knows something the rule does not.
 *
 * Nothing schedules anything. "Active" is a comparison of `startAt <= now <
 * endAt` at the moment it is asked — see lib/erp/schemes.ts — so a scheme
 * starts and stops on time without a job that could fail to run.
 */

export const SCHEME_CHANNELS = ["both", "b2c", "b2b"] as const;

const schemeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Flat paise or percent in basis points — the same pair a line stores. */
    discountType: { type: String, enum: ["flat", "percent"], default: "percent", required: true },
    discountValue: { type: Number, required: true, min: 0 },
    /** Empty means every product. */
    productIds: { type: [Schema.Types.ObjectId], ref: "Product", default: [] },
    /** Farmers, dealers, or everyone. */
    channel: { type: String, enum: SCHEME_CHANNELS, default: "both", required: true },
    startAt: { type: Date, required: true },
    /** EXCLUSIVE — a scheme ending "30 September" runs to the last second of it. */
    endAt: { type: Date, required: true },
    /** Off means paused by a person, whatever the dates say. */
    enabled: { type: Boolean, default: true },
    notes: { type: String, default: "", trim: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

/** The engine's question: which are on, and running, right now. */
schemeSchema.index({ enabled: 1, startAt: 1, endAt: 1 });

export type SchemeDoc = InferSchemaType<typeof schemeSchema>;

export const Scheme: Model<SchemeDoc> =
  (models.Scheme as Model<SchemeDoc>) ?? model<SchemeDoc>("Scheme", schemeSchema);
