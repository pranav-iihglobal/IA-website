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

import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Product } from "../lib/db/models/Product";
import { Testimonial } from "../lib/db/models/Testimonial";
import { Post } from "../lib/db/models/Post";
import {
  buildPostDocs,
  buildProductDocs,
  buildTestimonialDocs,
} from "./seed-data";

async function main() {
  const files = loadEnv();
  if (!process.env.MONGODB_URI) {
    console.error(
      "\n  MONGODB_URI is not set.\n" +
        (files.length
          ? `  Loaded ${files.join(", ")} but MONGODB_URI was not in it.\n`
          : "  No .env file found — copy .env.example to .env.local.\n") +
        "  Then run: npm run check-connection\n",
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
      returnDocument: "after",
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
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
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
      returnDocument: "after",
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
