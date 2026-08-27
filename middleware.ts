import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { isOwnerEmail } from "@/lib/auth/allowlist";

/*
  Built from auth.config.ts, NOT from auth.ts. auth.ts queries MongoDB in its
  signIn callback, and Mongoose cannot be loaded on the edge runtime — pulling
  it in here fails the build outright.
*/
const { auth } = NextAuth(authConfig);

/**
 * Guards the admin panel and its API.
 *
 * Runs on the edge and only verifies the signed session JWT — no database,
 * no Node-only crypto. Sign-in itself happens at /api/auth/*, which this
 * matcher deliberately does not cover.
 *
 * This is the fast, coarse layer. The authoritative check lives behind it in
 * the Node runtime (the dashboard layout and requireAdmin), which can query
 * the Director collection on every request.
 */

/** Reachable while signed out, or sign-in could never complete. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/restricted"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const email = request.auth?.user?.email;
  const token = request.auth as { admin?: boolean } | null;

  /*
    The edge runtime cannot reach MongoDB, so this layer answers the cheap
    half of the question: is there a session that was minted for an
    authorised account, or is this a permanent owner?

    Whether that account is STILL authorised is decided a moment later by the
    dashboard layout and requireAdmin(), both of which run in Node and query
    the database on every request. Removing a director therefore takes effect
    on their very next request — this check just avoids a database round trip
    for the common case of an ordinary, still-valid session.
  */
  const mintedForAdmin = request.auth?.user ? token?.admin === true : false;
  if (email && (isOwnerEmail(email) || mintedForAdmin)) {
    return NextResponse.next();
  }

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
