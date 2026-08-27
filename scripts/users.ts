/**
 * Manage admin access from a terminal.
 *
 * The People page lives behind the login it controls, which leaves one
 * problem it cannot solve for itself: creating the FIRST owner, and getting
 * back in if the collection is ever emptied or every owner is locked out.
 * This script is that path. It talks to MongoDB directly and never asks who
 * you are, so guard it the way you guard MONGODB_URI itself.
 *
 *   npm run users -- list
 *   npm run users -- add you@gmail.com owner "Your Name"
 *   npm run users -- role someone@gmail.com editor
 *   npm run users -- module accounts@iksarva.com posts none
 *   npm run users -- module accounts@iksarva.com posts follow
 *   npm run users -- suspend someone@gmail.com
 *   npm run users -- restore someone@gmail.com
 *   npm run users -- remove someone@gmail.com
 *   npm run users -- migrate          # copies an old `directors` collection in
 *
 * Run this once after deploying to create yourself:
 *
 *   npm run users -- add you@gmail.com owner
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { User } from "../lib/db/models/User";
import {
  LEVELS,
  LEVEL_LABELS,
  MODULES,
  MODULE_LABELS,
  ROLES,
  ROLE_LABELS,
  isLevel,
  isModuleKey,
  isRole,
  levelIn,
  type Level,
  type ModuleKey,
  type Role,
} from "../lib/auth/permissions";

loadEnv();

/** Deliberately permissive — Google is the real validator. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COMMANDS = [
  "list",
  "add",
  "role",
  "module",
  "suspend",
  "restore",
  "remove",
  "migrate",
] as const;

function usage(): never {
  console.log(
    [
      "",
      "Manage who can sign in to the admin panel.",
      "",
      "  npm run users -- list",
      "  npm run users -- add <email> [role] [name]",
      "  npm run users -- role <email> <role>",
      "  npm run users -- module <email> <module> <level|follow>",
      "  npm run users -- suspend <email>",
      "  npm run users -- restore <email>",
      "  npm run users -- remove <email>",
      "  npm run users -- migrate",
      "",
      `Roles: ${ROLES.join(", ")}`,
      ...ROLES.map((r) => `  ${r.padEnd(8)} ${ROLE_LABELS[r].description}`),
      "",
      `Modules: ${MODULES.join(", ")}`,
      `Levels:  ${LEVELS.join(", ")}, or "follow" to go back to the role`,
      ...LEVELS.map((l) => `  ${l.padEnd(8)} ${LEVEL_LABELS[l].description}`),
      "",
    ].join("\n"),
  );
  process.exit(1);
}

function normalise(raw: string | undefined): string {
  if (!raw) usage();
  const email = raw.trim().toLowerCase();
  if (!EMAIL.test(email)) {
    console.error(`\n"${email}" does not look like an email address.\n`);
    process.exit(1);
  }
  return email;
}

/**
 * Refuse anything that would leave no active owner.
 *
 * An ownerless panel can never grant access to anyone again — the only way
 * back is this script, and only if whoever runs it still has MONGODB_URI.
 */
async function guardLastOwner(email: string, action: string) {
  const target = await User.findOne({ email }).select("role status").lean();
  if (!target || target.role !== "owner" || target.status !== "active") return;

  const owners = await User.countDocuments({ role: "owner", status: "active" });
  if (owners <= 1) {
    console.error(`\nThat is the only active owner. ${action} would leave`);
    console.error("nobody able to manage access.\n");
    console.error("Make someone else an owner first:\n");
    console.error("  npm run users -- add colleague@gmail.com owner\n");
    process.exit(1);
  }
}

async function list() {
  const users = await User.find({})
    .select("email name role status modules addedBy lastSignInAt")
    .sort({ createdAt: 1 })
    .lean();

  if (users.length === 0) {
    console.log("\nNo users. Nobody can sign in.");
    console.log("Create the first owner:\n");
    console.log("  npm run users -- add you@gmail.com owner\n");
    return;
  }

  console.log(`\n${users.length} account(s):\n`);
  for (const user of users) {
    const suspended = user.status === "suspended" ? "  (suspended)" : "";
    const seen = user.lastSignInAt
      ? new Date(user.lastSignInAt).toISOString().slice(0, 10)
      : "never";
    console.log(
      `  ${String(user.email).padEnd(34)} ${String(user.role).padEnd(7)} ${user.name || ""}${suspended}`.trimEnd(),
    );
    const access = MODULES.map((m) => {
      const level = levelIn(
        {
          role: user.role as Role,
          modules: (user.modules ?? {}) as Partial<Record<ModuleKey, Level>>,
        },
        m,
      );
      const overridden = (user.modules as Record<string, unknown> | undefined)?.[m];
      return `${MODULE_LABELS[m]}:${level}${overridden ? "*" : ""}`;
    }).join("  ");
    console.log(`  ${" ".repeat(34)} ${access}`);
    console.log(`  ${" ".repeat(34)} last signed in ${seen}`);
  }

  console.log("\n  * = set for this person; everything else follows their role.");

  const owners = users.filter(
    (u) => u.role === "owner" && u.status === "active",
  ).length;
  if (owners === 0) {
    console.log("\n  ! No active owner. Nobody can change access from the panel.");
    console.log("    Fix with: npm run users -- role someone@gmail.com owner");
  }
  console.log("");
}

async function add(rawEmail: string | undefined, rawRole: string, name: string) {
  const email = normalise(rawEmail);
  const role: Role = rawRole ? (rawRole as Role) : "viewer";

  if (rawRole && !isRole(rawRole)) {
    console.error(`\n"${rawRole}" is not a role. Choose one of: ${ROLES.join(", ")}\n`);
    process.exit(1);
  }

  if (await User.exists({ email })) {
    console.log(`\n${email} already has access. Change it with:\n`);
    console.log(`  npm run users -- role ${email} <role>\n`);
    return;
  }

  await User.create({ email, name, role, addedBy: "cli" });
  console.log(`\n${email} can now sign in as ${ROLE_LABELS[role].label}.\n`);
}

async function setRole(rawEmail: string | undefined, rawRole: string | undefined) {
  const email = normalise(rawEmail);
  if (!rawRole || !isRole(rawRole)) {
    console.error(`\nChoose a role: ${ROLES.join(", ")}\n`);
    process.exit(1);
  }

  if (rawRole !== "owner") await guardLastOwner(email, "Demoting them");

  const result = await User.updateOne({ email }, { $set: { role: rawRole } });
  if (result.matchedCount === 0) {
    console.log(`\n${email} does not have access. Add them first.\n`);
    return;
  }
  console.log(`\n${email} is now ${ROLE_LABELS[rawRole].label}.`);
  console.log("Takes effect on their next request.\n");
}

/**
 * Override — or clear — one module for one person.
 *
 * "follow" removes the override entirely rather than writing the role's
 * current level, so a later role change moves this module with it.
 */
async function setModule(
  rawEmail: string | undefined,
  rawModule: string | undefined,
  rawLevel: string | undefined,
) {
  const email = normalise(rawEmail);

  if (!rawModule || !isModuleKey(rawModule)) {
    console.error(`\nChoose a module: ${MODULES.join(", ")}\n`);
    process.exit(1);
  }
  const follow = rawLevel === "follow";
  if (!follow && (!rawLevel || !isLevel(rawLevel))) {
    console.error(`\nChoose a level: ${LEVELS.join(", ")}, or "follow"\n`);
    process.exit(1);
  }

  const result = follow
    ? await User.updateOne({ email }, { $unset: { [`modules.${rawModule}`]: "" } })
    : await User.updateOne({ email }, { $set: { [`modules.${rawModule}`]: rawLevel } });

  if (result.matchedCount === 0) {
    console.log(`\n${email} does not have access. Add them first.\n`);
    return;
  }

  console.log(
    follow
      ? `\n${MODULE_LABELS[rawModule]} now follows ${email}'s role.\n`
      : `\n${email}: ${MODULE_LABELS[rawModule]} set to ${LEVEL_LABELS[rawLevel as Level].label}.\n`,
  );
}

async function setStatus(
  rawEmail: string | undefined,
  status: "active" | "suspended",
) {
  const email = normalise(rawEmail);
  if (status === "suspended") await guardLastOwner(email, "Suspending them");

  const result = await User.updateOne({ email }, { $set: { status } });
  if (result.matchedCount === 0) {
    console.log(`\n${email} does not have access. Nothing changed.\n`);
    return;
  }
  console.log(
    status === "suspended"
      ? `\n${email} can no longer sign in. Their record is kept.\n`
      : `\n${email} can sign in again.\n`,
  );
}

async function remove(rawEmail: string | undefined) {
  const email = normalise(rawEmail);
  await guardLastOwner(email, "Removing them");

  const result = await User.deleteOne({ email });
  if (result.deletedCount === 0) {
    console.log(`\n${email} did not have access. Nothing changed.\n`);
    return;
  }
  console.log(`\n${email} can no longer sign in.`);
  console.log("Their current session is refused on its next request. To kill it");
  console.log("outright, rotate AUTH_SECRET.\n");
}

/**
 * One-time import from the previous `directors` collection.
 *
 * That collection had no roles — being in it meant full access — so everyone
 * in it becomes an owner. Idempotent, and never downgrades an existing
 * account: run it twice and the second run reports zero.
 */
async function migrate() {
  const mongoose = await connectToDatabase();
  const db = mongoose.connection.db;
  if (!db) {
    console.error("\nNo database handle. Check MONGODB_URI.\n");
    process.exit(1);
  }

  const collections = await db.listCollections({ name: "directors" }).toArray();
  if (collections.length === 0) {
    console.log("\nNo `directors` collection here — nothing to migrate.\n");
    return;
  }

  const directors = await db.collection("directors").find({}).toArray();
  if (directors.length === 0) {
    console.log("\nThe `directors` collection is empty — nothing to migrate.\n");
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const director of directors) {
    const email = String(director.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email)) continue;

    if (await User.exists({ email })) {
      skipped++;
      continue;
    }
    await User.create({
      email,
      name: typeof director.name === "string" ? director.name : "",
      // The old collection was all-or-nothing access, which is what owner is.
      role: "owner",
      addedBy: typeof director.addedBy === "string" ? director.addedBy : "migration",
    });
    created++;
  }

  console.log(`\nMigrated ${created} director(s) to users as owners.`);
  if (skipped) console.log(`${skipped} already existed and were left alone.`);
  console.log("\nCheck the result, then drop the old collection when you are");
  console.log("happy: db.directors.drop() in the Atlas shell.\n");
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || !(COMMANDS as readonly string[]).includes(command)) usage();

  if (!process.env.MONGODB_URI) {
    console.error("\nMONGODB_URI is not set. Add it to .env.local first.\n");
    process.exit(1);
  }

  await connectToDatabase();

  if (command === "list") await list();
  else if (command === "add") await add(rest[0], rest[1], rest.slice(2).join(" "));
  else if (command === "role") await setRole(rest[0], rest[1]);
  else if (command === "module") await setModule(rest[0], rest[1], rest[2]);
  else if (command === "suspend") await setStatus(rest[0], "suspended");
  else if (command === "restore") await setStatus(rest[0], "active");
  else if (command === "remove") await remove(rest[0]);
  else await migrate();

  process.exit(0);
}

main().catch((error) => {
  console.error("\nFailed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
