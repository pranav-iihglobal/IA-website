import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { isAuthorisedEmail } from "@/lib/auth/directors";

/**
 * Admin authentication — Google sign-in only.
 *
 * There is no registration and no password anywhere in this app. Who may get
 * in is the Director collection, which the directors manage themselves at
 * /admin/directors — see lib/auth/directors.ts. The first one is created from
 * a terminal with `npm run directors -- add`.
 *
 * Sessions are JWTs in a cookie signed with AUTH_SECRET. Google identifies
 * the director once, at sign-in; every request afterwards is authenticated by
 * our own cookie, which is exactly what AUTH_SECRET protects.
 *
 * This module reaches MongoDB, so it must NEVER be imported by proxy.ts
 * — the edge runtime cannot load Mongoose. The proxy uses auth.config.ts
 * instead; see the note there.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ profile, user }) {
      // `profile` is Google's payload; `user` is the normalized shape.
      const email = profile?.email ?? user?.email;
      // Google marks unverified addresses; treating one as a director would
      // mean trusting an address its owner never proved they control.
      if (profile && profile.email_verified === false) return false;
      // The Director collection. This runs in the Node runtime, so the
      // database lookup is available here.
      return isAuthorisedEmail(email);
    },
  },
});
