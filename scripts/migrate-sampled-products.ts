/**
 * Turn `lead.productsSampled` free text into product references.
 *
 *   npm run migrate-sampled-products           # dry run, changes nothing
 *   npm run migrate-sampled-products -- --apply
 *
 * DRY BY DEFAULT, and it REPORTS what it cannot match rather than guessing —
 * the same rule the historical invoice import follows. A row whose text names
 * something not in the catalogue keeps its text and is listed at the end for a
 * person to look at. Guessing here would attach a sale to the wrong product
 * and then answer "which product converts best" with it.
 *
 * Idempotent: a contact that already has references is skipped, so a re-run
 * cannot overwrite a correction somebody made by hand afterwards.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Contact } from "../lib/db/models/Contact";
import { Product } from "../lib/db/models/Product";
import type { LeanDoc } from "../lib/db/lean";

loadEnv();

/** Loose enough for "Flora Max" vs "FloraMax", strict enough to stay honest. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function main() {
  const apply = process.argv.includes("--apply") || Boolean(process.env.npm_config_apply);
  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }
  if (!apply && process.env.npm_config_apply === undefined) {
    console.log("\n  DRY RUN — nothing will be written. Add `-- --apply` to write.\n");
  }

  await connectToDatabase();

  const products = (await Product.find().select("name sku").lean()) as LeanDoc[];
  const byName = new Map<string, string>();
  for (const p of products) {
    const id = String(p._id);
    if (p.name?.en) byName.set(normalise(p.name.en), id);
    if (p.sku) byName.set(normalise(p.sku), id);
  }
  console.log(`  Catalogue: ${products.length} products, ${byName.size} names and SKUs.\n`);

  const contacts = (await Contact.find({
    "lead.productsSampled": { $nin: ["", null] },
  })
    .select("name contactId lead.productsSampled lead.productIds")
    .lean()) as LeanDoc[];

  let matched = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const contact of contacts) {
    if ((contact.lead?.productIds ?? []).length > 0) {
      skipped++;
      continue;
    }

    const text: string = contact.lead?.productsSampled ?? "";
    /*
      Split on the separators the sheets actually use. A phrase that is not a
      product name simply will not match, which is the point.
    */
    const parts = text.split(/[,;/+&]|\band\b/i).map((s) => s.trim()).filter(Boolean);
    const ids: string[] = [];
    const misses: string[] = [];

    for (const part of parts) {
      const id = byName.get(normalise(part));
      if (id) {
        if (!ids.includes(id)) ids.push(id);
      } else {
        misses.push(part);
      }
    }

    if (misses.length > 0 || ids.length === 0) {
      unmatched.push(
        `${contact.contactId || contact.name || String(contact._id)}: "${text}"` +
          (ids.length > 0 ? ` (matched ${ids.length}, could not place ${misses.join(", ")})` : ""),
      );
      // All-or-nothing per row: a half-migrated row reads as complete and is
      // worse than one still holding its original note.
      continue;
    }

    matched++;
    if (apply) {
      await Contact.updateOne({ _id: contact._id }, { $set: { "lead.productIds": ids } });
    }
  }

  console.log(`  ${contacts.length} contacts have sampled-product text.`);
  console.log(`    ${skipped} already have references — left alone.`);
  console.log(`    ${matched} ${apply ? "converted" : "would convert"}.`);
  console.log(`    ${unmatched.length} could not be matched.\n`);

  if (unmatched.length > 0) {
    console.log("  Not converted — the text is kept and stays on screen:\n");
    for (const line of unmatched.slice(0, 40)) console.log(`    ${line}`);
    if (unmatched.length > 40) console.log(`    …and ${unmatched.length - 40} more.`);
    console.log();
  }

  if (!apply) console.log("  Nothing was written. Re-run with `-- --apply`.\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("\n  migrate-sampled-products failed:", error, "\n");
  process.exit(1);
});
