import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Someone allowed into the admin panel, managed from the panel itself.
 *
 * This is the routine way to add and remove directors. It does NOT replace
 * ADMIN_ALLOWED_EMAILS: the addresses in that variable are permanent owners
 * who are allowed whatever this collection says. That split is deliberate —
 * an empty, corrupted or unreachable collection must never be able to lock
 * everyone out of the panel that manages it.
 *
 * Email is the identity, because it is what Google verifies and what
 * `updatedBy` already records. It is stored lowercase and uniquely indexed,
 * so the same person cannot be added twice under different casing.
 */
const directorSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** Optional label, purely so the list reads as people rather than logins. */
    name: { type: String, trim: true, default: "" },
    /** Email of whoever granted this access. Set server-side from the session. */
    addedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export type DirectorDoc = InferSchemaType<typeof directorSchema>;

export const Director: Model<DirectorDoc> =
  (models.Director as Model<DirectorDoc>) ??
  model<DirectorDoc>("Director", directorSchema);
