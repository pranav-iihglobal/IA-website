import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Guards the admin panel and its API.
 *
 * Runs on the edge and only verifies the signed session JWT — no database,
 * no Node-only crypto. Sign-in itself happens at /api/auth/*, which this
 * matcher deliberately does not cover.
 */

/** Reachable while signed out, or sign-in could never complete. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/restricted"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const email = request.auth?.user?.email;

  /*
    Two separate questions, and both are asked on every request.

    Signed in? — and separately, still allowed? Sessions are JWTs that live
    for 14 days and are not checked against anything server-side, so a
    sign-in-only allowlist check would let someone removed from the list keep
    full access until their token expired. Re-checking here revokes on the
    next request instead.
  */
  if (email && isAllowedEmail(email)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: email ? "Not authorised" : "Not authenticated" },
      { status: email ? 403 : 401, headers: { "cache-control": "no-store" } },
    );
  }

  // Signed in with a Google account that is not on the list: say so, rather
  // than bouncing them back to a sign-in button that will never work.
  if (email) {
    return NextResponse.redirect(
      new URL("/admin/restricted", request.nextUrl.origin),
    );
  }

  const loginUrl = new URL("/admin/login", request.nextUrl.origin);
  if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
