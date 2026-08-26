/**
 * Connectivity and configuration smoke test — verifies Google sign-in config,
 * MongoDB Atlas and Cloudinary without writing any data.
 *
 *   npm run check-connection
 */

import { v2 as cloudinary } from "cloudinary";
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { getAllowedEmails } from "../lib/auth/allowlist";

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
 * Google sign-in configuration.
 *
 * Never prints the client secret — only whether it is present and roughly the
 * right shape.
 */
function checkAuth() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  if (!clientId) {
    fail("Google", "GOOGLE_CLIENT_ID not set");
  } else if (!clientId.endsWith(".apps.googleusercontent.com")) {
    fail(
      "Google",
      "GOOGLE_CLIENT_ID does not look like a Google client id",
      "it should end in .apps.googleusercontent.com",
    );
  } else {
    pass("Google", `client ${clientId.split("-")[0]}…`);
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    fail(
      "Google",
      "GOOGLE_CLIENT_SECRET not set",
      "Google Cloud → APIs & Services → Credentials → iksarva-admin-web",
    );
  } else {
    pass("Google", "client secret set");
  }

  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length >= 32) {
    pass("Session", `AUTH_SECRET set (${secret.length} chars)`);
  } else {
    fail(
      "Session",
      secret ? `AUTH_SECRET is only ${secret.length} chars, need 32+` : "AUTH_SECRET not set",
      "openssl rand -base64 32",
    );
  }

  // Optional second gate — see lib/auth/allowlist.ts.
  const allowed = getAllowedEmails();
  if (allowed) {
    pass("Allowlist", `only ${allowed.join(", ")}`);
  } else {
    pass(
      "Allowlist",
      "not set — access is whoever is a test user on the Google consent screen",
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

  checkAuth();
  await checkMongo();
  await checkCloudinary();

  if (problems > 0) {
    console.log(`\n${problems} problem(s) found — see the arrows above.\n`);
    process.exit(1);
  }
  console.log("\nEverything is configured correctly.\n");
}

main();
