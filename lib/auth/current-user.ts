import { cache } from "react";
import { auth } from "@/auth";
import { findActiveUser, type ActiveUser } from "./users";

/**
 * Who is asking, resolved at most once per request.
 *
 * Rendering one admin page asked the database who you are TWICE: the
 * dashboard layout needs your role for the nav, and the page's own guard
 * needs it to decide whether you may be here at all. Both are correct and
 * neither can be dropped — but they are the same question, asked a
 * millisecond apart, and each was a separate round trip to Atlas plus a
 * separate decrypt of the session cookie. API routes did the same thing when
 * a handler both guarded and then asked who was calling.
 *
 * React's cache() dedupes within a single server render pass, so the second
 * caller gets the first one's promise.
 *
 * This is NOT a cache in the usual sense, deliberately: it lives for exactly
 * one request and is thrown away. Suspending or demoting someone still takes
 * effect on their very next request, which is the property the whole
 * authorisation design rests on — see lib/auth/users.ts.
 *
 * Lives in its own file because auth.ts already imports users.ts, and putting
 * this beside findActiveUser would close the cycle.
 */

/**
 * The decoded session.
 *
 * Needed on its own only for the Google avatar, which comes from the token
 * rather than the User document.
 */
export const currentSession = cache(() => auth());

/** The signed-in user as the database sees them, or null. */
export const currentActiveUser = cache(async (): Promise<ActiveUser | null> => {
  const session = await currentSession();
  return findActiveUser(session?.user?.email);
});
