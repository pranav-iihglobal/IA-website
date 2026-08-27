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
 * Nothing in here may import from lib/db/** or lib/auth/users.ts, or
 * anything that reaches them.
 *
 * Note what is deliberately NOT here: the role. An earlier version stashed an
 * `admin` flag on the token at sign-in for the proxy to read, and it locked
 * out every user, because `request.auth` in the proxy is a Session — whatever
 * the session callback returns — not the token, and the flag was never copied
 * across. The fix is not to copy it more carefully; it is to stop duplicating
 * authorisation state into a second runtime that cannot verify it. A session
 * can only exist if the signIn callback approved it, so its mere existence is
 * all the proxy needs. What the person may actually DO is answered against the
 * database, in Node, on every request. See lib/auth/users.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Always show the account chooser: colleagues may share a browser, and
      // silently reusing whichever Google session is active is worse than one
      // extra click.
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
};
