import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * The edge-safe half of the auth setup.
 *
 * proxy.ts runs on the edge runtime, where Mongoose cannot run at all —
 * importing it there fails the build. So the configuration is split: this
 * file holds everything that is pure JavaScript over the request and the
 * token, and auth.ts adds the `signIn` callback that queries the database.
 *
 * Nothing in here may import from lib/db/**, lib/auth/directors.ts, or
 * anything that reaches them.
 */
export const authConfig: NextAuthConfig = {
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
    jwt({ token, profile }) {
      // Only runs on sign-in, when `profile` is present.
      if (profile) {
        token.name = profile.name ?? token.name;
        token.email = profile.email ?? token.email;
        token.picture = profile.picture ?? token.picture;
        /*
          Reaching here means the signIn callback in auth.ts returned true, so
          this account was authorised at the moment the token was minted.
          proxy.ts reads this flag on the edge, where it cannot ask the
          database.

          It is a fast path, not the authority: access can be revoked after
          the token exists, so the Node-runtime layers behind the proxy — the
          dashboard layout and requireAdmin() — re-check against the database
          on every request. A revoked director gets past the proxy and is
          stopped immediately after.
        */
        token.admin = true;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? null;
        session.user.email = token.email ?? "";
        session.user.image = token.picture ?? null;
        /*
          Must be copied explicitly. `request.auth` in proxy.ts is a Session,
          which is whatever THIS callback returns — not the JWT above. A flag
          set on the token and never copied here is simply absent on the edge,
          which reads as "not an admin" and locks out every director.
        */
        session.user.admin = token.admin === true;
      }
      return session;
    },
  },

  // The site runs on a custom domain behind Vercel's proxy.
  trustHost: true,
};
