import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * The panel's own settings — today, one document: who the seller is.
 *
 * IKSARVA's GSTIN, PAN, state code and bank details were a constant in
 * lib/content.ts, so changing a bank account was a code change and a deploy.
 * They are a document now, keyed by a fixed string id (`"seller"`, see
 * lib/erp/seller.ts) so there is exactly one and the audit log can name it.
 *
 * The constant stays as the fallback until this document is first saved —
 * nothing changes on the day the page ships.
 *
 * Every invoice takes a COPY of this at issue (Invoice.seller). This record
 * is what the NEXT invoice will say; it is never read for one already issued.
 */

const bankSchema = new Schema(
  {
    accountName: { type: String, default: "", trim: true },
    name: { type: String, default: "", trim: true },
    accountNo: { type: String, default: "", trim: true },
    ifsc: { type: String, default: "", trim: true, uppercase: true },
    upi: { type: String, default: "", trim: true, lowercase: true },
  },
  { _id: false },
);

const settingsSchema = new Schema(
  {
    _id: { type: String, required: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    /** Derived from the GSTIN on save — see deriveSeller(). */
    pan: { type: String, default: "", trim: true, uppercase: true },
    stateCode: { type: String, default: "", trim: true },
    bank: { type: bankSchema, default: () => ({}) },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const Settings: Model<SettingsDoc> =
  (models.Settings as Model<SettingsDoc>) ??
  model<SettingsDoc>("Settings", settingsSchema);
