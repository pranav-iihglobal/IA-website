import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

/**
 * Shared helpers for admin API route handlers.
 */

/**
 * Defence in depth: middleware already blocks unauthenticated requests to
 * /api/admin/*, but every handler re-checks so a future matcher change can
 * never silently expose a mutation endpoint.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
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
  if (session?.user?.email) return null;
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * Which director is saving this, for the "last edited by" line in the admin.
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

/** Map thrown errors to a useful response instead of a generic 500. */
export function errorResponse(error: unknown): NextResponse {
  // Duplicate unique key (slug)
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  ) {
    return NextResponse.json(
      { error: "That slug is already used by another item. Choose a different one." },
      { status: 409 },
    );
  }
  const message =
    error instanceof Error ? error.message : "Something went wrong";
  console.error("[admin api]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Flatten zod issues into { "path.to.field": "message" } for the form. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fieldErrors(issues: any[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

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
