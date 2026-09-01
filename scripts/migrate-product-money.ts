/**
 * One-off: product prices become integer paise, the GST rate becomes basis
 * points.
 *
 *   npm run migrate-product-money            # dry run — reports, writes nothing
 *   npm run migrate-product-money -- --apply # actually writes
 *
 * WHY. Prices were stored as rupee floats. That is fine for printing "₹245" on
 * a page and wrong for an invoice: ₹12.35 is 12.3499999999999996 in binary, so
 * a total computed from floats stops agreeing with the sum of its own lines —
 * exactly the drift their spreadsheets have. And the GST rate was a percentage,
 * which cannot hold 2.5% as an integer. See lib/money.ts and lib/erp/tax.ts.
 *
 * SAFE TO RUN TWICE. Each document is converted only if it still has an old
 * field; anything already migrated is skipped and counted. A half-finished run
 * can simply be run again.
 *
 * It reads through the raw collection rather than the Mongoose model on
 * purpose: the model no longer declares `mrp`, `dealerPrice` or
 * `gstRatePercent`, so a model query would hand back documents with those
 * fields already stripped and there would be nothing left to migrate.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Product } from "../lib/db/models/Product";
import { rupeesToPaise, formatINR } from "../lib/money";

loadEnv();

const APPLY = process.argv.includes("--apply");

/** A stored rupee amount as paise, or undefined if there was nothing there. */
function paise(value: unknown): number | undefined {
  if (typeof value !== "number") return undefined;
  return rupeesToPaise(value) ?? undefined;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }

  await connectToDatabase();
  const collection = Product.collection;
  const products = await collection.find({}).toArray();

  console.log(
    `\n  ${APPLY ? "APPLYING" : "DRY RUN — nothing will be written"}\n` +
      `  ${products.length} product${products.length === 1 ? "" : "s"}\n`,
  );

  let converted = 0;
  let skipped = 0;

  for (const doc of products) {
    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    const notes: string[] = [];

    if (typeof doc.gstRatePercent === "number" && doc.gstRateBps === undefined) {
      set.gstRateBps = Math.round(doc.gstRatePercent * 100);
      unset.gstRatePercent = "";
      notes.push(`GST ${doc.gstRatePercent}% → ${set.gstRateBps}bp`);
    }

    const packs = Array.isArray(doc.packSizes) ? doc.packSizes : [];
    const migratedPacks = packs.map((pack: Record<string, unknown>) => {
      const { mrp, dealerPrice, ...rest } = pack;
      const next: Record<string, unknown> = { ...rest };

      // Only fill a paise field that is not already set, so re-running cannot
      // overwrite a price someone has since corrected in the admin.
      const carry = (from: unknown, to: string, label: string) => {
        const value = paise(from);
        if (value === undefined || next[to] !== undefined) return;
        next[to] = value;
        notes.push(`${pack.label} ${label} ${formatINR(value)}`);
      };
      carry(mrp, "mrpPaise", "MRP");
      carry(dealerPrice, "dealerPricePaise", "dealer");
      return next;
    });

    const packsChanged =
      JSON.stringify(migratedPacks) !== JSON.stringify(packs);
    if (packsChanged) set.packSizes = migratedPacks;

    if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
      skipped++;
      console.log(`  · ${doc.slug} — already converted, nothing to do`);
      continue;
    }

    converted++;
    console.log(`  ${APPLY ? "✓" : "→"} ${doc.slug} — ${notes.join(", ") || "packs rewritten"}`);

    if (APPLY) {
      const update: Record<string, unknown> = {};
      if (Object.keys(set).length) update.$set = set;
      if (Object.keys(unset).length) update.$unset = unset;
      await collection.updateOne({ _id: doc._id }, update);
    }
  }

  console.log(
    `\n  ${converted} to convert, ${skipped} already done.` +
      (APPLY
        ? "\n  Written. Check a product page and the admin form.\n"
        : "\n  Nothing written. Re-run with --apply when the list above looks right.\n"),
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("\n  migrate-product-money failed:", error, "\n");
  process.exit(1);
});
