/**
 * Connectivity smoke test — verifies MongoDB Atlas and Cloudinary
 * credentials without writing any data.
 *
 *   npm run check-connection
 */

import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { connectToDatabase } from "../lib/db/connect";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "").trim();
  }
}

async function checkMongo() {
  if (!process.env.MONGODB_URI) {
    console.log("  MongoDB      ✗  MONGODB_URI not set");
    return;
  }
  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    const collections = await db!.listCollections().toArray();
    console.log(
      `  MongoDB      ✓  connected to "${db!.databaseName}" ` +
        `(${collections.length} collection${collections.length === 1 ? "" : "s"})`,
    );
    for (const c of collections) {
      const n = await db!.collection(c.name).countDocuments();
      console.log(`                  · ${c.name}: ${n} document(s)`);
    }
    await mongoose.disconnect();
  } catch (error) {
    console.log(`  MongoDB      ✗  ${String(error).slice(0, 220)}`);
  }
}

async function checkCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.log("  Cloudinary   ✗  credentials not set");
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
    console.log(`  Cloudinary   ✓  ping ${result.status} (cloud: ${CLOUDINARY_CLOUD_NAME})`);
  } catch (error) {
    let message: string;
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
    console.log(`  Cloudinary   ✗  ${message.slice(0, 300)}`);
  }
}

async function main() {
  loadEnvLocal();
  console.log("\nChecking service connections…\n");
  await checkMongo();
  await checkCloudinary();
  console.log("");
}

main();
