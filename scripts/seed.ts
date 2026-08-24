/**
 * Seed / migrate existing hardcoded content into MongoDB.
 *
 *   npm run seed
 *
 * Idempotent: everything is upserted by slug (or farmer name for
 * testimonials), so running it twice will not create duplicates. Existing
 * documents are updated in place — edits made in the admin panel to fields
 * this script sets WILL be overwritten, so only re-run it deliberately.
 *
 * The document mapping lives in scripts/seed-data.ts (pure, no DB access).
 */

import fs from "fs";
import path from "path";

import { connectToDatabase } from "../lib/db/connect";
import { Product } from "../lib/db/models/Product";
import { Testimonial } from "../lib/db/models/Testimonial";
import { Post } from "../lib/db/models/Post";
import {
  buildPostDocs,
  buildProductDocs,
  buildTestimonialDocs,
} from "./seed-data";

/* --- minimal .env.local loader (tsx does not load it the way Next does) --- */
function loadEnvLocal() {
  if (process.env.MONGODB_URI) return;
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

async function main() {
  loadEnvLocal();
  if (!process.env.MONGODB_URI) {
    console.error(
      "\n  MONGODB_URI is not set.\n" +
        "  Put it in .env.local (see .env.example) and run again.\n",
    );
    process.exit(1);
  }

  console.log("\nSeeding IKSARVA content into MongoDB…\n");
  const mongoose = await connectToDatabase();

  // Products ---------------------------------------------------------------
  const productDocs = buildProductDocs();
  for (const doc of productDocs) {
    await Product.findOneAndUpdate({ slug: doc.slug }, doc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
  console.log(`  products      ${productDocs.length} upserted`);

  // Testimonials -----------------------------------------------------------
  const products = await Product.find().select("name").lean();
  const idByName = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products.map((p: any) => [String(p.name?.en ?? ""), String(p._id)]),
  );
  const testimonialDocs = buildTestimonialDocs(idByName);
  for (const doc of testimonialDocs) {
    await Testimonial.findOneAndUpdate(
      { "farmerName.en": doc.farmerName.en },
      doc,
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log(
    `  testimonials  ${testimonialDocs.length} upserted (samples kept as drafts)`,
  );

  // Posts ------------------------------------------------------------------
  const postDocs = buildPostDocs();
  for (const doc of postDocs) {
    await Post.findOneAndUpdate({ slug: doc.slug }, doc, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
  }
  console.log(`  posts         ${postDocs.length} upserted`);

  await mongoose.disconnect();
  console.log("\nDone.\n");
}

main().catch((error) => {
  console.error("\nSeed failed:", error);
  process.exit(1);
});
