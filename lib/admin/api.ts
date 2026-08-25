import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSession, isAdminAuthenticated } from "@/lib/auth/session";

/**
 * Shared helpers for admin API route handlers.
 */

/**
 * Defence in depth: middleware already blocks unauthenticated requests to
 * /api/admin/*, but every handler re-checks so a future matcher change can
 * never silently expose a mutation endpoint.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

/**
 * Who is saving this, for the "last edited by" line in the admin.
 *
 * Read from the session cookie, never from the request body — otherwise a
 * client could claim to be anyone.
 */
export async function currentEditor(): Promise<string> {
  try {
    const session = await getAdminSession();
    return session.email ?? "";
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
