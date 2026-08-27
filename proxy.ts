import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/*
  Built from auth.config.ts, NOT from auth.ts. auth.ts queries MongoDB in its
  signIn callback, and Mongoose cannot be loaded on the edge runtime — pulling
  it in here fails the build outright.
*/
const { auth } = NextAuth(authConfig);

/**
 * Guards the admin panel and its API.
 *
 * Runs on the edge and answers exactly one question: is there a valid session?
 * No database, no roles, no permissions — none of which the edge can verify.
 *
 * That is enough, because a session cannot exist unless the signIn callback in
 * auth.ts approved it against the database. So "has a session" already means
 * "was an active user moments ago". What that person may DO, and whether they
 * still may, is decided immediately behind this by the Node-runtime layers —
 * the dashboard layout and requirePermission() — which read the database on
 * every request. Suspending or demoting someone therefore takes effect on
 * their very next request rather than when their token expires.
 *
 * Resisting the temptation to cache the role in the token is the point. An
 * earlier version did, and locked out every user when the flag failed to
 * survive the trip from the JWT to the Session.
 */

/** Reachable while signed out, or sign-in could never complete. */
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/restricted"];

export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const email = request.auth?.user?.email;
  if (email) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const loginUrl = new URL("/admin/login", request.nextUrl.origin);
  if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
