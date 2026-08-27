import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { findActiveUser, recordSignIn } from "@/lib/auth/users";

/**
 * Admin authentication — Google sign-in only.
 *
 * There is no registration and no password anywhere in this app. Who may get
 * in is the User collection, managed at /admin/users — see lib/auth/users.ts.
 * The first owner is created from a terminal with `npm run users -- add`.
 *
 * Sessions are JWTs in a cookie signed with AUTH_SECRET. Google identifies
 * the person once, at sign-in; every request afterwards is authenticated by
 * our own cookie, which is exactly what AUTH_SECRET protects.
 *
 * The session deliberately carries no role. Authentication is settled here;
 * authorisation is a separate question, asked against the database on every
 * request so that a change to someone's role takes effect at once.
 *
 * This module reaches MongoDB, so it must NEVER be imported by proxy.ts —
 * the edge runtime cannot load Mongoose. The proxy uses auth.config.ts
 * instead; see the note there.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ profile, user }) {
      // `profile` is Google's payload; `user` is the normalized shape.
      const email = profile?.email ?? user?.email;
      // Google marks unverified addresses; letting one in would mean trusting
      // an address its owner never proved they control.
      if (profile && profile.email_verified === false) return false;

      // The User collection. This runs in the Node runtime, so the database
      // lookup is available here.
      const active = await findActiveUser(email);
      if (!active) return false;

      // Bookkeeping only, and deliberately not awaited into the decision —
      // see recordSignIn. A failed stamp must never fail a sign-in.
      void recordSignIn(active.email);
      return true;
    },
  },
});
