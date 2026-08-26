/**
 * Guards the admin authorisation rules.
 *
 * These are pure functions over ADMIN_ALLOWED_EMAILS, so they can be checked
 * with no server, no Google and no database — which is the point: the bug
 * this replaced (an allowlist that returned true when unset, opening the
 * panel to every Google account) would have been caught by the very first
 * assertion below.
 *
 *   npm run check-auth
 */
import { getAllowedEmails, isAllowedEmail, isAllowlistConfigured } from "@/lib/auth/allowlist";

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function withAllowlist<T>(value: string | undefined, run: () => T): T {
  const previous = process.env.ADMIN_ALLOWED_EMAILS;
  if (value === undefined) delete process.env.ADMIN_ALLOWED_EMAILS;
  else process.env.ADMIN_ALLOWED_EMAILS = value;
  try {
    return run();
  } finally {
    if (previous === undefined) delete process.env.ADMIN_ALLOWED_EMAILS;
    else process.env.ADMIN_ALLOWED_EMAILS = previous;
  }
}

console.log("Fails closed when nothing is configured:");
withAllowlist(undefined, () => {
  check("unset rejects a real address", isAllowedEmail("someone@gmail.com"), false);
  check("unset rejects everything", isAllowedEmail("director@iksarva.com"), false);
  check("unset reports not configured", isAllowlistConfigured(), false);
});
withAllowlist("", () => {
  check("empty string rejects", isAllowedEmail("someone@gmail.com"), false);
});
withAllowlist("   ,  , ", () => {
  check("separators only rejects", isAllowedEmail("someone@gmail.com"), false);
  check("separators only is not configured", isAllowlistConfigured(), false);
});

console.log("\nAllows exactly the configured addresses:");
withAllowlist("director.one@iksarva.com, Director.Two@IKSARVA.com", () => {
  check("listed address", isAllowedEmail("director.one@iksarva.com"), true);
  check("case-insensitive", isAllowedEmail("DIRECTOR.TWO@iksarva.com"), true);
  check("surrounding spaces ignored", isAllowedEmail("  director.one@iksarva.com  "), true);
  check("unlisted address rejected", isAllowedEmail("stranger@gmail.com"), false);
  check("empty email rejected", isAllowedEmail(""), false);
  check("null email rejected", isAllowedEmail(null), false);
  check("undefined email rejected", isAllowedEmail(undefined), false);
  check("no partial match", isAllowedEmail("director.one@iksarva.com.attacker.test"), false);
  check("no substring match", isAllowedEmail("not-director.one@iksarva.com"), false);
  check("reports configured", isAllowlistConfigured(), true);
  check("parses both entries", getAllowedEmails().length, 2);
});

if (failures > 0) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll auth checks passed.");
