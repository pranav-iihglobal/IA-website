import { connectToDatabase } from "@/lib/db/connect";
import { Director } from "@/lib/db/models/Director";

/**
 * Who may use the admin panel.
 *
 * One list, in the database, managed at /admin/directors. There is no
 * environment variable: adding and removing people is ordinary admin work,
 * not a deploy.
 *
 * The bootstrap problem — the page that grants access sits behind the login
 * it controls — is solved by `npm run directors`, which reads MONGODB_URI and
 * writes the collection directly. That is how the first director is created,
 * and how you get back in if the collection is ever emptied.
 *
 * Node runtime only: Mongoose cannot run on the edge, which is why
 * middleware.ts trusts the session token instead and the authoritative checks
 * live in the dashboard layout and requireAdmin(). Those run on every
 * request, so removing someone takes effect immediately rather than when
 * their token expires.
 *
 * Deliberately not cached. A findOne on a unique index costs almost nothing,
 * a handful of people use this panel, and a cache would mean a removed
 * director keeps access for however long the cache lives. Correctness is
 * worth more than the query.
 */

/** Lowercased, trimmed — Google reports addresses in their canonical form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * True when this address may use the admin panel.
 *
 * Fails closed. An unreachable database is not a reason to let someone in;
 * use `npm run directors` to recover if that is what is actually wrong.
 */
export async function isAuthorisedEmail(
  email: string | null | undefined,
): Promise<boolean> {
  if (!email) return false;
  try {
    await connectToDatabase();
    return Boolean(await Director.exists({ email: normalizeEmail(email) }));
  } catch (error) {
    console.error("[auth] director lookup failed", error);
    return false;
  }
}

/**
 * How many people have access.
 *
 * Zero means the panel is closed to everyone, which the restricted page
 * reports specifically — otherwise the first director sees "you are not on
 * the list" and has no way to guess there is no list yet.
 */
export async function countDirectors(): Promise<number> {
  try {
    await connectToDatabase();
    return await Director.countDocuments({});
  } catch {
    // Unknown rather than zero. Saying "nobody has access" when the database
    // is merely unreachable would send someone off to fix the wrong thing.
    return -1;
  }
}

export interface DirectorEntry {
  id: string;
  email: string;
  name: string;
  addedBy: string;
  createdAt: string | null;
}

/** Everyone with access, oldest first. */
export async function listDirectors(): Promise<DirectorEntry[]> {
  await connectToDatabase();
  const docs = await Director.find({})
    .select("email name addedBy createdAt")
    .sort({ createdAt: 1 })
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    email: doc.email,
    name: doc.name ?? "",
    addedBy: doc.addedBy ?? "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  }));
}
