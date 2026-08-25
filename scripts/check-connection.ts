/**
 * Connectivity and configuration smoke test — verifies the admin credentials,
 * MongoDB Atlas and Cloudinary without writing any data.
 *
 *   npm run check-connection
 */

import { v2 as cloudinary } from "cloudinary";
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { normalizePasswordHash } from "../lib/auth/password";

let problems = 0;

function fail(label: string, message: string, hint?: string) {
  problems += 1;
  console.log(`  ${label.padEnd(12)} ✗  ${message}`);
  if (hint) console.log(`  ${" ".repeat(12)}   → ${hint}`);
}

function pass(label: string, message: string) {
  console.log(`  ${label.padEnd(12)} ✓  ${message}`);
}

/**
 * Catches the most common setup mistake: bcrypt hashes are full of "$" and
 * Next.js expands $VAR inside .env files, so an unescaped hash silently
 * arrives truncated and every login fails with "Incorrect email or password".
 */
function checkAdmin() {
  if (!process.env.ADMIN_EMAIL) {
    fail("Admin", "ADMIN_EMAIL not set");
  } else {
    pass("Admin", `email ${process.env.ADMIN_EMAIL}`);
  }

  const raw = process.env.ADMIN_PASSWORD_HASH;
  if (!raw) {
    fail("Password", "ADMIN_PASSWORD_HASH not set", "npm run hash-password -- 'your-password'");
  } else {
    const hash = normalizePasswordHash(raw);
    const looksValid = /^\$2[aby]?\$\d{2}\$.{53}$/.test(hash);
    if (looksValid) {
      pass("Password", "hash looks valid");
    } else {
      fail(
        "Password",
        `hash is ${hash.length} characters, expected 60 — it was mangled by .env variable expansion`,
        'escape every "$" as "\\$" in your .env file (npm run hash-password prints it ready to paste)',
      );
    }
  }

  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 32) {
    pass("Session", `secret set (${secret.length} chars)`);
  } else {
    fail(
      "Session",
      secret ? `secret is only ${secret.length} chars, need 32+` : "SESSION_SECRET not set",
      "openssl rand -base64 32",
    );
  }
}

async function checkMongo() {
  if (!process.env.MONGODB_URI) {
    fail("MongoDB", "MONGODB_URI not set");
    return;
  }
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db!;
    const collections = await db.listCollections().toArray();
    pass(
      "MongoDB",
      `connected to "${db.databaseName}" (${collections.length} collection${collections.length === 1 ? "" : "s"})`,
    );
    for (const c of collections) {
      const n = await db.collection(c.name).countDocuments();
      console.log(`  ${" ".repeat(12)}   · ${c.name}: ${n} document(s)`);
    }
    if (db.databaseName === "test") {
      console.log(
        `  ${" ".repeat(12)}   ! No database name in the URI — add "/iksarva" before the "?"`,
      );
    }
    await mongoose.disconnect();
  } catch (error) {
    const message = String(error);
    fail(
      "MongoDB",
      message.slice(0, 160),
      message.includes("whitelist") || message.includes("ServerSelection")
        ? "Atlas → Network Access → add 0.0.0.0/0"
        : undefined,
    );
  }
}

async function checkCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    fail("Cloudinary", "credentials not set");
    return;
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  try {
    const result = await cloudinary.api.ping();
    pass("Cloudinary", `ping ${result.status} (cloud: ${CLOUDINARY_CLOUD_NAME})`);
  } catch (error) {
    let message: string;
    try {
      const e = error as { error?: { message?: string }; message?: string };
      message = e.error?.message ?? e.message ?? JSON.stringify(error);
    } catch {
      message = String(error);
    }
    fail("Cloudinary", message.slice(0, 160));
  }
}

async function main() {
  const files = loadEnv();
  console.log("\nChecking configuration and service connections…\n");
  if (files.length === 0) {
    console.log(
      "  No .env file found in this directory.\n" +
        "  Create .env.local (copy .env.example) and fill in the values.\n",
    );
  } else {
    console.log(`  Loaded: ${files.join(", ")}\n`);
  }

  checkAdmin();
  await checkMongo();
  await checkCloudinary();

  if (problems > 0) {
    console.log(`\n${problems} problem(s) found — see the arrows above.\n`);
    process.exit(1);
  }
  console.log("\nEverything is configured correctly.\n");
}

main();
