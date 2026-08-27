/**
 * Exercise the SIGNED-IN half of the admin guard.
 *
 * Every other check in this repo tests the signed-out path — that a stranger
 * gets a redirect or a 401. That path was always fine. What shipped broken
 * was the opposite one: a real director, correctly signed in, bounced to
 * /admin/restricted because the `admin` flag was set on the JWT and read off
 * the Session, which are two different objects. Nothing caught it, because
 * testing it needs a session, and getting a session needed Google.
 *
 * It does not. A session cookie is just a JWE signed with AUTH_SECRET, and
 * this app has AUTH_SECRET. So we mint one and drive the guard with it.
 *
 *   npm run build && npm start          # in one terminal
 *   npm run check-auth                  # in another
 *   npm run check-auth -- https://iksarva.com
 *
 * Against a remote host, AUTH_SECRET must be the one THAT host uses, or the
 * cookie it mints will not decrypt there and every case reads as signed-out.
 */
import { loadEnv } from "./load-env";
import { encode } from "next-auth/jwt";

loadEnv();

const BASE = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const COOKIE_NAME = "authjs.session-token";
/** The cookie name doubles as the encryption salt — Auth.js derives the key from it. */
const SECURE_COOKIE_NAME = "__Secure-authjs.session-token";

/** Auth.js prefixes the cookie on https, and the name is part of the key derivation. */
const isHttps = BASE.startsWith("https://");
const name = isHttps ? SECURE_COOKIE_NAME : COOKIE_NAME;

async function cookieFor(claims: Record<string, unknown>): Promise<string> {
  const jwt = await encode({
    token: {
      name: "Check Auth",
      email: "check-auth@example.invalid",
      sub: "check-auth",
      ...claims,
    },
    secret: process.env.AUTH_SECRET!,
    salt: name,
    maxAge: 60 * 5,
  });
  return `${name}=${jwt}`;
}

interface Case {
  label: string;
  path: string;
  cookie: string | null;
  /** What a correct guard does. */
  expect: (status: number, location: string | null) => boolean;
  describe: string;
}

function redirectsTo(target: string) {
  return (status: number, location: string | null) =>
    status >= 300 && status < 400 && Boolean(location?.includes(target));
}

async function main() {
  if (!process.env.AUTH_SECRET) {
    console.error("\nAUTH_SECRET is not set. Add it to .env.local first.\n");
    process.exit(1);
  }

  const admin = await cookieFor({ admin: true });
  const plain = await cookieFor({});

  const cases: Case[] = [
    {
      label: "signed out",
      path: "/admin/products",
      cookie: null,
      expect: redirectsTo("/admin/login"),
      describe: "redirected to the login",
    },
    {
      label: "signed out",
      path: "/api/admin/products",
      cookie: null,
      expect: (s) => s === 401,
      describe: "401",
    },
    {
      /*
        The regression this file exists for. A director holding a valid
        session must get PAST the proxy. Past it the Node layer re-checks the
        Director collection, so a 403 or a bounce to /admin/restricted from
        THERE is still correct — what must never happen is the proxy itself
        turning them away, which is what a missing `admin` flag caused.
      */
      label: "signed in, admin flag",
      path: "/api/admin/products",
      cookie: admin,
      expect: (s) => s !== 401,
      describe: "not 401 (the proxy let it reach the Node check)",
    },
    {
      label: "signed in, NO admin flag",
      path: "/api/admin/products",
      cookie: plain,
      expect: (s) => s === 403,
      describe: "403 (session predates the Director module)",
    },
    {
      label: "signed in, NO admin flag",
      path: "/admin/products",
      cookie: plain,
      expect: redirectsTo("/admin/restricted"),
      describe: "sent to /admin/restricted",
    },
  ];

  console.log(`\nChecking the admin guard at ${BASE}\n`);

  let failed = 0;
  for (const c of cases) {
    let status = 0;
    let location: string | null = null;
    try {
      const response = await fetch(`${BASE}${c.path}`, {
        redirect: "manual",
        headers: c.cookie ? { cookie: c.cookie } : {},
      });
      status = response.status;
      location = response.headers.get("location");
    } catch (error) {
      console.error(
        `  ✗  ${c.label} → ${c.path}\n     could not reach ${BASE} — is the server running?\n     ${error instanceof Error ? error.message : error}\n`,
      );
      process.exit(1);
    }

    const ok = c.expect(status, location);
    if (!ok) failed++;
    const arrow = location ? ` → ${location}` : "";
    console.log(
      `  ${ok ? "✓" : "✗"}  ${c.label.padEnd(24)} ${c.path.padEnd(22)} ${status}${arrow}`,
    );
    if (!ok) console.log(`     expected: ${c.describe}`);
  }

  if (failed > 0) {
    console.error(`\n${failed} check(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nThe admin guard behaves correctly in both directions.\n");
}

main().catch((error) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
