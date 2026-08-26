import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

  if (request.auth?.user) return NextResponse.next();

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
