import type { DefaultSession } from "next-auth";

/**
 * The `admin` flag, declared on both shapes it has to travel through.
 *
 * It is set on the JWT at sign-in (auth.config.ts) and read off the SESSION
 * in proxy.ts. Those are two different objects: `request.auth` inside the
 * middleware wrapper is a Session, built by the `session` callback, not the
 * raw token. Anything the callback does not copy across simply is not there.
 *
 * Declaring it in both places is what makes that copy a type error to forget.
 */
declare module "next-auth" {
  interface Session {
    user: {
      /** True when this session was minted for an account that was a
       *  director at sign-in. A fast path only — see auth.config.ts. */
      admin?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    admin?: boolean;
  }
}
