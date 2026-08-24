import type { SessionOptions } from "iron-session";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

/**
 * Single-admin session, stored in an encrypted (iron-session) cookie.
 * No user table, no registration, no roles — the credentials live in env.
 */

export interface AdminSession {
  isLoggedIn?: boolean;
  email?: string;
  loginAt?: number;
}

export const SESSION_COOKIE = "iksarva_admin";

export function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a random string of at least 32 characters (see .env.example).",
    );
  }
  return {
    password,
    cookieName: SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    },
  };
}

/** Read (or create) the session in a Server Component / Route Handler. */
export async function getAdminSession() {
  return getIronSession<AdminSession>(await cookies(), getSessionOptions());
}

/** True when the current request carries a valid admin session. */
export async function isAdminAuthenticated(): Promise<boolean> {
  try {
    const session = await getAdminSession();
    return Boolean(session.isLoggedIn);
  } catch {
    return false;
  }
}
