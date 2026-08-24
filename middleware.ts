import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { AdminSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/session";

/**
 * Guards the admin panel and its API.
 *
 * Runs on the edge, so it only *reads* the encrypted session cookie — no
 * bcrypt, no database. Password verification happens in the login route
 * handler (Node runtime).
 */

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/api/admin/login"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const password = process.env.SESSION_SECRET;

  let loggedIn = false;
  if (password && password.length >= 32) {
    try {
      const session = await getIronSession<AdminSession>(request, response, {
        password,
        cookieName: SESSION_COOKIE,
      });
      loggedIn = Boolean(session.isLoggedIn);
    } catch {
      loggedIn = false;
    }
  }

  if (loggedIn) return response;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
