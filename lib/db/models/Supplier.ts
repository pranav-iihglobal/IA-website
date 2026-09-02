import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Who IKSARVA buys from.
 *
 * Until now a supplier was two free-text fields retyped on every purchase —
 * the name, and a GSTIN that was mistyped as often as it was typed, on the
 * one field that decides whether input credit can be claimed. "How much did
 * we buy from Shree Poly Pack this year" was unanswerable, because "Shree
 * Poly Pack", "Shree Polypack" and "SHREE POLY PACK" were three suppliers.
 *
 * A purchase now REFERENCES a supplier and still SNAPSHOTS the name and
 * GSTIN — the same design as an invoice's party. A bill is a filed document,
 * and the GSTIN on it is what the input credit was claimed against at the
 * time; correcting the supplier record later must not rewrite history.
 */

const supplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Their GSTIN. Blank means no input credit on anything they sell us. */
    gstin: { type: String, default: "", trim: true, uppercase: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    /** Decides intra- or inter-state, hence CGST+SGST or IGST on their bills. */
    state: { type: String, default: "Gujarat", trim: true },
    notes: { type: String, default: "", trim: true },

    isSample: { type: Boolean, default: false, index: true },
    updatedBy: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

supplierSchema.index({ name: 1 });
/*
  One GSTIN, one supplier. Two records with the same GSTIN are the same
  business entered twice — and a partial index, because most small suppliers
  have no GSTIN at all and "" must not collide with "".
*/
supplierSchema.index(
  { gstin: 1 },
  {
    unique: true,
    name: "gstin_unique_when_set",
    partialFilterExpression: { gstin: { $type: "string", $gt: "" } },
  },
);

export type SupplierDoc = InferSchemaType<typeof supplierSchema>;

export const Supplier: Model<SupplierDoc> =
  (models.Supplier as Model<SupplierDoc>) ??
  model<SupplierDoc>("Supplier", supplierSchema);
