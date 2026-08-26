import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth/allowlist";

/**
 * Admin authentication — Google sign-in only.
 *
 * There is no user collection, no registration and no password anywhere in
 * this app. Access is granted by Google Cloud's OAuth test-user list (the
 * consent screen stays in "Testing" status), optionally narrowed further by
 * ADMIN_ALLOWED_EMAILS — see lib/auth/allowlist.ts.
 *
 * Sessions are JWTs in a cookie signed with AUTH_SECRET. Nothing is written
 * to MongoDB, so authentication costs the free-tier cluster nothing. Google
 * identifies the director once, at sign-in; every request afterwards is
 * authenticated by our own cookie, which is what AUTH_SECRET protects.
 *
 * Deliberately edge-safe (no database adapter, no Node-only imports) so
 * middleware.ts can verify a session without a Node runtime.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Always show the account chooser: both directors may share a browser,
      // and silently reusing whichever Google session is active is worse than
      // one extra click.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 14, // 14 days
  },

  pages: {
    signIn: "/admin/login",
    // Rejected sign-ins and OAuth failures land on a branded page rather than
    // the default Auth.js error screen.
    error: "/admin/restricted",
  },

  callbacks: {
    signIn({ profile, user }) {
      // `profile` is Google's payload; `user` is the normalized shape.
      const email = profile?.email ?? user?.email;
      // Google marks unverified addresses; treating one as a director would
      // mean trusting an address its owner never proved they control.
      if (profile && profile.email_verified === false) return false;
      return isAllowedEmail(email);
    },

    jwt({ token, profile }) {
      // Only runs on sign-in, when `profile` is present.
      if (profile) {
        token.name = profile.name ?? token.name;
        token.email = profile.email ?? token.email;
        token.picture = profile.picture ?? token.picture;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? null;
        session.user.email = token.email ?? "";
        session.user.image = token.picture ?? null;
      }
      return session;
    },
  },

  // The site runs on a custom domain behind Vercel's proxy.
  trustHost: true,
});
