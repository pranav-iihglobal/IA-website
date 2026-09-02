import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { currentActiveUser } from "@/lib/auth/current-user";
import type { ActiveUser } from "@/lib/auth/users";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/permissions";
import { diffFields, recordAudit } from "@/lib/db/models/AuditLog";

/**
 * Shared helpers for admin API route handlers.
 */

/**
 * Defence in depth, and the only place authorisation is actually decided.
 *
 * The proxy already turned away anyone without a session, but it runs on the
 * edge and cannot reach the database, so it knows nothing about roles. This
 * does, and it asks fresh every request — a demoted or suspended user loses
 * access on their very next call rather than when their token expires.
 *
 * Authentication and authorisation stay separate questions here. A valid
 * session only proves Google vouched for the address; whether that address
 * may perform THIS action is the User collection's call, checked against the
 * permission the route names.
 */
export async function requirePermission(
  permission: Permission,
): Promise<NextResponse | null> {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // Every route calls this BEFORE its try/catch, so an exception here would
    // surface as a bare 500 with nothing to debug. A broken auth config is a
    // server problem, not an unauthenticated request — say so.
    console.error("[admin api] session check failed", error);
    return NextResponse.json(
      {
        error:
          "Sign-in is not configured correctly on the server. Check GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and AUTH_SECRET.",
      },
      { status: 500 },
    );
  }

  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await currentActiveUser();
  if (!user) {
    // Deliberately does not echo the address back or say why.
    console.warn("[admin api] rejected a signed-in account with no active user row");
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  }

  if (!can(user, permission)) {
    /*
      Named in the response on purpose. This is not an attacker probing for
      what exists — they are signed in and we know exactly who they are. Being
      told "your role cannot do this" is the difference between a colleague
      asking for an upgrade and a colleague filing a bug.
    */
    return NextResponse.json(
      {
        error: `Your role (${ROLE_LABELS[user.role].label}) cannot do this. Ask an owner for access.`,
      },
      { status: 403 },
    );
  }

  return null;
}

/**
 * The signed-in user as the database sees them right now, or null.
 *
 * For routes that need more than a yes/no — the ones whose rules depend on
 * WHO is asking, like refusing to let someone remove their own access.
 */
export async function currentUser(): Promise<ActiveUser | null> {
  try {
    // Deduped with requirePermission's lookup: a route that guards and then
    // asks who is calling costs one database round trip, not two.
    return await currentActiveUser();
  } catch {
    return null;
  }
}

/**
 * Which user is saving this, for the "last edited by" line in the admin.
 *
 * Read from the verified Google session, never from the request body —
 * otherwise a client could claim to be anyone.
 */
export async function currentEditor(): Promise<string> {
  try {
    const session = await auth();
    // Email is the stable identity; the display name can change on the
    // Google account at any time.
    return session?.user?.email ?? session?.user?.name ?? "";
  } catch {
    return "";
  }
}

/**
 * What to say when a unique index refuses a write, by the field it guards.
 *
 * Mongo names the index in `keyPattern`; the message names the thing the
 * person typed. Anything not listed gets the honest generic line rather than
 * "that slug" — which is what every duplicate used to be called, including
 * a contact id.
 */
const DUPLICATE_MESSAGES: Record<string, string> = {
  slug: "That slug is already used by another item. Choose a different one.",
  contactId: "That id is already on another contact. Leave it blank to have one allocated.",
  gstin: "Another record already carries that GSTIN.",
};

/** Map thrown errors to a useful response instead of a generic 500. */
export function errorResponse(error: unknown): NextResponse {
  // Duplicate unique key
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  ) {
    const pattern = (error as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
    const field = Object.keys(pattern).find((key) => key in DUPLICATE_MESSAGES);
    return NextResponse.json(
      {
        error: field
          ? DUPLICATE_MESSAGES[field]
          : "Another record already has that value. Choose a different one.",
        ...(field ? { fields: { [field]: DUPLICATE_MESSAGES[field] } } : {}),
      },
      { status: 409 },
    );
  }
  const message =
    error instanceof Error ? error.message : "Something went wrong";
  console.error("[admin api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/*
  Re-exported so every route keeps importing it from here, while the forms can
  reach the same function without dragging next/server into the browser.
*/
export { fieldErrors } from "./field-errors";

/** Push changes live immediately instead of waiting for ISR to expire. */
export function revalidateProduct(slug?: string) {
  revalidatePath("/");
  revalidatePath("/products");
  if (slug) revalidatePath(`/products/${slug}`);
}

export function revalidateTestimonials() {
  revalidatePath("/testimonials");
}

export function revalidatePost(slug?: string) {
  revalidatePath("/learn");
  if (slug) revalidatePath(`/learn/${slug}`);
}

/**
 * Record a change, without every route repeating the same six lines.
 *
 * Wraps recordAudit() with the two things a route always has to supply and
 * always supplies the same way: the actor from the verified session, and the
 * diff rather than two whole documents.
 *
 * Never throws — recordAudit() does not, and a failed audit write must not
 * roll back the change it describes.
 */
export async function auditChange(entry: {
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string;
}): Promise<void> {
  const { before, after } = diffFields(entry.before, entry.after);
  await recordAudit({
    actor: await currentEditor(),
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before,
    after,
    note: entry.note,
  });
}
