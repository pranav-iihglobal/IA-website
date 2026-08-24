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
console.log("\nADMIN_PASSWORD_HASH=" + JSON.stringify(hash) + "\n");
