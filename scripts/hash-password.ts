/**
 * Generate the bcrypt hash for the admin password.
 *
 *   npm run hash-password -- 'your-strong-password'
 *
 * Copy the printed hash into ADMIN_PASSWORD_HASH (.env.local and Vercel).
 * The plaintext password is never stored anywhere.
 */

import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error(
    "\n  Usage: npm run hash-password -- 'your-strong-password'\n" +
      "  (quote the password so the shell does not mangle it)\n",
  );
  process.exit(1);
}

if (password.length < 10) {
  console.error("\n  Use at least 10 characters.\n");
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);

// Next.js expands `$VAR` inside .env files, and bcrypt hashes are full of `$`.
// So the .env.local form needs each `$` escaped; Vercel's dashboard does not
// expand anything, so it takes the raw hash.
console.log("\n1) For .env.local — note the escaped $ signs:\n");
console.log(`ADMIN_PASSWORD_HASH="${hash.replace(/\$/g, "\\$")}"`);
console.log("\n2) For the Vercel dashboard — paste this raw value:\n");
console.log(hash);
console.log("");
