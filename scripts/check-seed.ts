/**
 * Validate the seed mapping WITHOUT touching a database.
 *
 *   npm run check-seed
 *
 * Runs every document the seed would write through the shared zod schemas —
 * the same validation the admin API enforces. Catches mapping mistakes
 * (missing required fields, bad enums, malformed bilingual values) before
 * anything reaches MongoDB.
 */

import { productSchema, testimonialSchema, postSchema } from "../lib/schemas";
import {
  buildPostDocs,
  buildProductDocs,
  buildTestimonialDocs,
} from "./seed-data";

let failures = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function check(label: string, schema: any, docs: unknown[]) {
  for (const [index, doc] of docs.entries()) {
    const result = schema.safeParse(doc);
    if (result.success) continue;
    failures += 1;
    console.error(`\n  ✗ ${label}[${index}] failed validation:`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const issue of result.error.issues as any[]) {
      console.error(`      ${issue.path.join(".") || "(root)"}: ${issue.message}`);
    }
  }
  console.log(`  ${label.padEnd(13)} ${docs.length} documents checked`);
}

console.log("\nValidating seed documents against the shared zod schemas…\n");

const products = buildProductDocs();
check("products", productSchema, products);

// Testimonials reference products by name; fake ids are fine for validation.
const fakeIds = new Map(
  products.map((p, i) => [p.name.en, String(i).padStart(24, "0")]),
);
check("testimonials", testimonialSchema, buildTestimonialDocs(fakeIds));

check("posts", postSchema, buildPostDocs());

if (failures > 0) {
  console.error(`\n${failures} document(s) failed validation.\n`);
  process.exit(1);
}
console.log("\nAll seed documents are valid.\n");
