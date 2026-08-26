import { Schema } from "mongoose";

/**
 * Bilingual subdocuments, in the two flavours lib/schemas.ts already defines
 * for zod — and they must stay paired with it, because zod validates the
 * request and Mongoose validates the save. A field that zod lets through as
 * blank but Mongoose requires cannot be saved at all.
 *
 * The distinction matters more than it looks, because of a Mongoose quirk:
 * `required: true` on a String rejects the **empty string**, not just
 * `undefined`. So marking `en` required on an optional field means leaving
 * that field blank in the admin form fails validation on save — which is
 * exactly the bug this file was extracted to fix. The models had defined
 * `en` as required and then given optional fields
 * `default: () => ({ en: "", gu: "" })`: a default that violated its own
 * schema.
 *
 * Rule of thumb: if zod uses `biSchema`, use `requiredBi` here. If zod uses
 * `biOptionalSchema`, use `optionalBi`.
 */

/** English required, Gujarati optional — falls back to English at render. */
export const requiredBi = new Schema(
  {
    en: { type: String, required: true, trim: true },
    gu: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/** Both sides may be blank. For fields an admin can legitimately skip. */
export const optionalBi = new Schema(
  {
    en: { type: String, default: "", trim: true },
    gu: { type: String, default: "", trim: true },
  },
  { _id: false },
);

/** The empty value for an optional bilingual field. */
export const emptyBi = () => ({ en: "", gu: "" });
