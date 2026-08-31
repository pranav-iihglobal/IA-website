import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { LEVELS, ROLES, type ModuleKey } from "@/lib/auth/permissions";

/**
 * One optional level field per module, for the per-user overrides below.
 *
 * `satisfies Record<ModuleKey, unknown>` is the point of writing it out here
 * rather than inline: the sub-schema is a CLOSED list, so a module added to
 * MODULES but missed here would accept an override and silently discard it.
 * With this, that mistake stops compiling instead.
 *
 * Written literally rather than generated from MODULES because Mongoose needs
 * the concrete keys to infer the document type.
 */
const MODULE_LEVEL_FIELDS = {
  products: { type: String, enum: LEVELS },
  testimonials: { type: String, enum: LEVELS },
  posts: { type: String, enum: LEVELS },
  /** Dealers and leads. */
  crm: { type: String, enum: LEVELS },
} satisfies Record<ModuleKey, unknown>;

/**
 * Someone allowed into the admin panel.
 *
 * Email is the identity, because it is what Google verifies and what
 * `updatedBy` already records across the content collections. Stored
 * lowercase and uniquely indexed, so one person cannot exist twice under
 * different casing.
 *
 * There is no password field and there never will be — Google does the
 * authentication, this collection only answers what that person may do.
 *
 * Suspending rather than deleting is the normal way to cut someone off:
 * their row stays, so the "last edited by" lines on old content still
 * resolve to a person rather than a dangling address.
 */
const userSchema = new Schema(
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
    role: {
      type: String,
      enum: ROLES,
      // The least privilege that still lets someone in. A misconfigured or
      // half-written document must never default to power.
      default: "viewer",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      required: true,
    },
    /*
      Per-module overrides. A module left unset follows the role, which is why
      these have no defaults — "unset" and "explicitly set to the same thing
      the role gives" must stay distinguishable, or changing someone's role
      would silently fail to move the modules they never customised.
    */
    modules: {
      type: new Schema(MODULE_LEVEL_FIELDS, { _id: false }),
      default: () => ({}),
    },
    /** Email of whoever granted this access. Set server-side from the session. */
    addedBy: { type: String, trim: true, default: "" },
    /** Stamped on each sign-in, so a stale account is visible as stale. */
    lastSignInAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
