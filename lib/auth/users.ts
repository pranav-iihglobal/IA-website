import { connectToDatabase } from "@/lib/db/connect";
import { User } from "@/lib/db/models/User";
import {
  MODULES,
  isLevel,
  isRole,
  type Access,
  type Level,
  type ModuleKey,
  type Role,
} from "@/lib/auth/permissions";

/**
 * Who may use the admin panel, and as what.
 *
 * One collection, managed at /admin/users. There is no environment
 * variable: adding people and changing what they can do is ordinary admin
 * work, not a deploy.
 *
 * The bootstrap problem — the page that grants access sits behind the login
 * it controls — is solved by `npm run users`, which reads MONGODB_URI and
 * writes the collection directly. That is how the first owner is created,
 * and how you get back in if the collection is ever emptied.
 *
 * Node runtime only: Mongoose cannot run on the edge, which is why proxy.ts
 * trusts the session token instead and the authoritative checks live in the
 * dashboard layout and requirePermission(). Those run on every request, so
 * suspending someone — or demoting them — takes effect immediately rather
 * than whenever their token happens to expire.
 *
 * Deliberately not cached. A findOne on a unique index costs almost nothing,
 * a handful of people use this panel, and a cache would mean a demoted user
 * keeps their old powers for however long the cache lives.
 */

/** Lowercased, trimmed — Google reports addresses in their canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface ActiveUser extends Access {
  email: string;
  name: string;
  role: Role;
  modules: Partial<Record<ModuleKey, Level>>;
}

/**
 * Read the per-module overrides off a document, discarding anything unknown.
 *
 * Mongoose already enforces the enum on write, so a bad value here means the
 * document was edited outside the app. Dropping it falls back to the role,
 * which is the safe direction: a typo removes an override, it never invents
 * access that was not granted.
 */
function readModules(raw: unknown): Partial<Record<ModuleKey, Level>> {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<Record<ModuleKey, Level>> = {};
  for (const key of MODULES) {
    const value = source[key];
    if (isLevel(value)) out[key] = value;
  }
  return out;
}

/**
 * The signed-in person as the database currently sees them, or null.
 *
 * Null covers every refusal for the same reason — no such user, suspended,
 * an unreadable role, or the database being unreachable. Callers only ever
 * need to know "may this request proceed", and collapsing the cases here
 * means no caller can accidentally treat one of them as a yes.
 *
 * Fails closed. An unreachable database is not a reason to let someone in;
 * use `npm run users` to recover if that is what is actually wrong.
 */
export async function findActiveUser(
  email: string | null | undefined,
): Promise<ActiveUser | null> {
  if (!email) return null;
  try {
    await connectToDatabase();
    const doc = await User.findOne({ email: normalizeEmail(email) })
      .select("email name role status modules")
      .lean();

    if (!doc || doc.status !== "active") return null;
    // A role outside the enum means a hand-edited or half-migrated document.
    // Treat it as no access rather than guessing which one was meant.
    if (!isRole(doc.role)) {
      console.error(`[auth] user ${doc.email} has an unrecognised role`);
      return null;
    }

    return {
      email: doc.email,
      name: doc.name ?? "",
      role: doc.role,
      modules: readModules(doc.modules),
    };
  } catch (error) {
    console.error("[auth] user lookup failed", error);
    return null;
  }
}

/** True when this address may sign in at all. Used by the signIn callback. */
export async function isAuthorisedEmail(
  email: string | null | undefined,
): Promise<boolean> {
  return Boolean(await findActiveUser(email));
}

/**
 * Best-effort sign-in stamp.
 *
 * Never allowed to fail a sign-in: someone being unable to get in because a
 * bookkeeping write failed would be a far worse bug than a missing date.
 */
export async function recordSignIn(email: string): Promise<void> {
  try {
    await connectToDatabase();
    await User.updateOne(
      { email: normalizeEmail(email) },
      { $set: { lastSignInAt: new Date() } },
    );
  } catch (error) {
    console.error("[auth] could not stamp lastSignInAt", error);
  }
}

/**
 * How many people have access.
 *
 * Zero means the panel is closed to everyone, which the restricted page
 * reports specifically — otherwise the first owner sees "you are not on the
 * list" and has no way to guess there is no list yet.
 */
export async function countUsers(): Promise<number> {
  try {
    await connectToDatabase();
    return await User.countDocuments({});
  } catch {
    // Unknown rather than zero. Saying "nobody has access" when the database
    // is merely unreachable would send someone off to fix the wrong thing.
    return -1;
  }
}

export interface UserEntry {
  id: string;
  email: string;
  name: string;
  role: Role;
  modules: Partial<Record<ModuleKey, Level>>;
  status: "active" | "suspended";
  addedBy: string;
  lastSignInAt: string | null;
  createdAt: string | null;
}

/** Everyone with access, most privileged first, then oldest first. */
export async function listUsers(): Promise<UserEntry[]> {
  await connectToDatabase();
  const docs = await User.find({})
    .select("email name role status modules addedBy lastSignInAt createdAt")
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    email: doc.email,
    name: doc.name ?? "",
    role: isRole(doc.role) ? doc.role : "viewer",
    modules: readModules(doc.modules),
    status: doc.status === "suspended" ? "suspended" : "active",
    addedBy: doc.addedBy ?? "",
    lastSignInAt: doc.lastSignInAt
      ? new Date(doc.lastSignInAt).toISOString()
      : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  }));
}

/**
 * How many owners are left.
 *
 * Guards every operation that could remove the last one — deleting,
 * suspending, or demoting. An ownerless panel cannot grant access to anyone
 * again, and is recoverable only from a terminal with MONGODB_URI.
 */
export async function countActiveOwners(): Promise<number> {
  await connectToDatabase();
  return User.countDocuments({ role: "owner", status: "active" });
}
