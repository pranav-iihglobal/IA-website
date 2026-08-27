/**
 * Manage admin access from a terminal.
 *
 * The Directors page lives behind the login it controls, which leaves one
 * problem it cannot solve for itself: creating the FIRST director, and
 * getting back in if the collection is ever emptied. This script is that
 * path. It talks to MongoDB directly and never asks who you are, so guard it
 * the way you guard MONGODB_URI itself.
 *
 *   npm run directors -- list
 *   npm run directors -- add you@gmail.com "Your Name"
 *   npm run directors -- remove someone@gmail.com
 *
 * Run it once after deploying to create yourself:
 *
 *   npm run directors -- add you@gmail.com
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Director } from "../lib/db/models/Director";

loadEnv();

/** Deliberately permissive — Google is the real validator. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function usage(): never {
  console.log(
    [
      "",
      "Manage who can sign in to the admin panel.",
      "",
      "  npm run directors -- list",
      "  npm run directors -- add <email> [name]",
      "  npm run directors -- remove <email>",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

async function list() {
  const directors = await Director.find({})
    .select("email name addedBy createdAt")
    .sort({ createdAt: 1 })
    .lean();

  if (directors.length === 0) {
    console.log("\nNo directors. Nobody can sign in.");
    console.log("Create the first one:\n");
    console.log("  npm run directors -- add you@gmail.com\n");
    return;
  }

  console.log(`\n${directors.length} director(s) can sign in:\n`);
  for (const director of directors) {
    const when = director.createdAt
      ? new Date(director.createdAt).toISOString().slice(0, 10)
      : "";
    const by = director.addedBy ? ` by ${director.addedBy}` : "";
    console.log(
      `  ${director.email.padEnd(34)} ${director.name || ""}`.trimEnd() +
        (when ? `\n  ${" ".repeat(34)} added ${when}${by}` : ""),
    );
  }
  console.log("");
}

async function add(rawEmail: string | undefined, name: string) {
  if (!rawEmail) usage();
  const email = rawEmail.trim().toLowerCase();

  if (!EMAIL.test(email)) {
    console.error(`\n"${email}" does not look like an email address.\n`);
    process.exit(1);
  }

  if (await Director.exists({ email })) {
    console.log(`\n${email} already has access.\n`);
    return;
  }

  await Director.create({ email, name, addedBy: "cli" });
  console.log(`\n${email} can now sign in with Google.\n`);
}

async function remove(rawEmail: string | undefined) {
  if (!rawEmail) usage();
  const email = rawEmail.trim().toLowerCase();

  const total = await Director.countDocuments({});
  if (total <= 1) {
    console.error(
      "\nThat is the only director. Removing them would lock everyone out.",
    );
    console.error("Add someone else first.\n");
    process.exit(1);
  }

  const result = await Director.deleteOne({ email });
  if (result.deletedCount === 0) {
    console.log(`\n${email} was not a director. Nothing changed.\n`);
    return;
  }
  console.log(`\n${email} can no longer sign in.`);
  console.log(
    "Their current session is refused on its next request. To kill it",
  );
  console.log("outright, rotate AUTH_SECRET.\n");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !["list", "add", "remove"].includes(command)) usage();

  if (!process.env.MONGODB_URI) {
    console.error("\nMONGODB_URI is not set. Add it to .env.local first.\n");
    process.exit(1);
  }

  await connectToDatabase();

  if (command === "list") await list();
  else if (command === "add") await add(rest[0], rest.slice(1).join(" "));
  else await remove(rest[0]);

  process.exit(0);
}

main().catch((error) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
