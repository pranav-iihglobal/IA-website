import { handlers } from "@/auth";

/**
 * Auth.js endpoints: /api/auth/signin, /callback/google, /signout, /session.
 *
 * Deliberately NOT under /api/admin — middleware guards that prefix, and the
 * Google callback has to be reachable while signed out.
 */
export const { GET, POST } = handlers;
