import { connectToDatabase } from "@/lib/db/connect";
import { Director } from "@/lib/db/models/Director";
import { isOwnerEmail, normalizeEmail } from "./allowlist";

/**
 * Authorisation, resolved against the database.
 *
 * Node runtime only — Mongoose cannot run on the edge, which is why
 * middleware.ts uses the cheaper checks in ./allowlist and this module is
 * called from the places that can reach a database: the sign-in callback,
 * the admin API handlers and the dashboard layout. Those are the layers that
 * actually gate reading and writing, so revocation still takes effect on the
 * very next request rather than whenever a token expires.
 *
 * Deliberately not cached. A findOne on a unique index costs almost nothing,
 * two people use this panel, and caching would mean removing someone leaves
 * them with access for the length of the cache. Correctness is worth more
 * than the query.
 */

/** Owners (from env) plus directors (from the database). */
export async function isAuthorisedEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  // Owners are allowed without touching the database, so the panel stays
  // reachable when Atlas is down or the collection is empty.
  if (isOwnerEmail(email)) return true;

  try {
    await connectToDatabase();
    const found = await Director.exists({ email: normalizeEmail(email) });
    return Boolean(found);
  } catch (error) {
    // Fail closed. An unreachable database is not a reason to let someone in;
    // owners can still get in via the env list above and fix things.
    console.error("[auth] director lookup failed", error);
    return false;
  }
}

export interface DirectorEntry {
  id: string;
  email: string;
  name: string;
  addedBy: string;
  createdAt: string | null;
  /** Owners come from ADMIN_ALLOWED_EMAILS and cannot be removed here. */
  isOwner: boolean;
}

/**
 * Everyone with access, owners first.
 *
 * Owners are synthesised from the environment rather than read from the
 * collection, so the list shown in the panel is the whole truth about who can
 * get in — not just the half that happens to be stored.
 */
export async function listAuthorised(): Promise<DirectorEntry[]> {
  const { getOwnerEmails } = await import("./allowlist");
  const owners = getOwnerEmails();

  const entries: DirectorEntry[] = owners.map((email) => ({
    id: `owner:${email}`,
    email,
    name: "",
    addedBy: "",
    createdAt: null,
    isOwner: true,
  }));

  await connectToDatabase();
  const docs = await Director.find({})
    .select("email name addedBy createdAt")
    .sort({ createdAt: 1 })
    .lean();

  for (const doc of docs) {
    // An address that is also an owner is already listed; showing it twice
    // would imply removing the row would remove their access, and it would not.
    if (owners.includes(doc.email)) continue;
    entries.push({
      id: String(doc._id),
      email: doc.email,
      name: doc.name ?? "",
      addedBy: doc.addedBy ?? "",
      createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
      isOwner: false,
    });
  }

  return entries;
}
