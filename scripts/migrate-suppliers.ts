/**
 * Turn the free-text supplier on every purchase and stock item into a
 * Supplier record, and link the rows to it.
 *
 *   npm run migrate-suppliers              # dry run, changes nothing
 *   npm run migrate-suppliers -- --apply
 *
 * DRY BY DEFAULT, and it REPORTS what it cannot decide rather than guessing —
 * the rule every conversion in this project follows. Rows are grouped by a
 * normalised name ("Shree Poly Pack" and "SHREE POLYPACK" are one supplier);
 * one record is created per group with the GSTIN the rows carry. Where a
 * group carries TWO different GSTINs, nothing is created for it and it is
 * listed at the end: that is either two businesses sharing a name or one
 * business with a mistyped GSTIN on some bills, and only a person can say
 * which.
 *
 * Idempotent: a row that already has a supplierId is skipped, an existing
 * record with the same name or GSTIN is reused, so a re-run cannot create a
 * duplicate or overwrite a link somebody fixed by hand.
 *
 * The snapshot fields on each row — the name and GSTIN as entered — are
 * NOT rewritten. A bill is a filed document.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Purchase } from "../lib/db/models/Purchase";
import { StockItem } from "../lib/db/models/StockItem";
import { Supplier } from "../lib/db/models/Supplier";
import type { LeanDoc } from "../lib/db/lean";

loadEnv();

const APPLY = process.argv.includes("--apply");
/*
  `npm run migrate-suppliers --apply` does NOT reach this script — npm keeps
  the flag for itself as an environment variable and runs a dry run that
  looks exactly like the command that was asked for. Say so, rather than
  treating the variable as consent.
*/
const SWALLOWED_BY_NPM = !APPLY && process.env.npm_config_apply !== undefined;

/** Loose enough for spacing and case, strict enough to stay honest. */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

interface Group {
  names: Set<string>;
  gstins: Set<string>;
  purchases: LeanDoc[];
  stock: LeanDoc[];
  isSample: boolean;
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }
  if (SWALLOWED_BY_NPM) {
    console.log(
      "\n  You passed --apply, but npm kept it for itself.\n" +
        "  It needs a -- separator to reach this script:\n\n" +
        "      npm run migrate-suppliers -- --apply\n\n" +
        "  Showing the dry run instead.",
    );
  }
  console.log(`\n  ${APPLY ? "APPLYING" : "DRY RUN — nothing will be written"}\n`);

  await connectToDatabase();

  const [purchases, stock, existing] = await Promise.all([
    Purchase.find({ supplierId: null, supplier: { $nin: ["", null] } })
      .select("supplier supplierGstin isSample")
      .lean() as Promise<LeanDoc[]>,
    StockItem.find({ supplierId: null, supplier: { $nin: ["", null] } })
      .select("supplier isSample")
      .lean() as Promise<LeanDoc[]>,
    Supplier.find().select("name gstin").lean() as Promise<LeanDoc[]>,
  ]);

  // Records already on file, by name and by GSTIN, so a re-run reuses them.
  const byName = new Map<string, LeanDoc>();
  const byGstin = new Map<string, LeanDoc>();
  for (const s of existing) {
    byName.set(normalise(s.name ?? ""), s);
    if (s.gstin) byGstin.set(s.gstin, s);
  }

  const groups = new Map<string, Group>();
  const group = (name: string): Group => {
    const key = normalise(name);
    let g = groups.get(key);
    if (!g) {
      g = { names: new Set(), gstins: new Set(), purchases: [], stock: [], isSample: true };
      groups.set(key, g);
    }
    g.names.add(name.trim());
    return g;
  };
  for (const p of purchases) {
    const g = group(p.supplier);
    g.purchases.push(p);
    if (p.supplierGstin) g.gstins.add(String(p.supplierGstin).toUpperCase());
    if (!p.isSample) g.isSample = false;
  }
  for (const s of stock) {
    const g = group(s.supplier);
    g.stock.push(s);
    if (!s.isSample) g.isSample = false;
  }

  let created = 0;
  let reused = 0;
  let linkedPurchases = 0;
  let linkedStock = 0;
  const conflicts: string[] = [];

  for (const [key, g] of groups) {
    if (g.gstins.size > 1) {
      conflicts.push(
        `${[...g.names][0]}: ${g.purchases.length + g.stock.length} rows carry ${g.gstins.size} GSTINs — ${[...g.gstins].join(", ")}`,
      );
      continue;
    }
    const gstin = [...g.gstins][0] ?? "";

    // Reuse before create: by GSTIN first (the stronger identity), then name.
    let record = (gstin && byGstin.get(gstin)) || byName.get(key) || null;
    if (record && gstin && record.gstin && record.gstin !== gstin) {
      conflicts.push(
        `${[...g.names][0]}: rows say ${gstin}, the existing record says ${record.gstin}`,
      );
      continue;
    }

    if (record) {
      reused++;
    } else {
      created++;
      if (APPLY) {
        const doc = await Supplier.create({
          // The longest spelling is usually the one with the suffix on it.
          name: [...g.names].sort((a, b) => b.length - a.length)[0],
          gstin,
          isSample: g.isSample,
          updatedBy: "migrate-suppliers",
        });
        record = { _id: doc._id, name: doc.name, gstin: doc.gstin };
        byName.set(key, record);
        if (gstin) byGstin.set(gstin, record);
      }
    }

    linkedPurchases += g.purchases.length;
    linkedStock += g.stock.length;
    if (APPLY && record) {
      // The id only. The name and GSTIN on each row are the filed snapshot.
      await Purchase.updateMany(
        { _id: { $in: g.purchases.map((p) => p._id) } },
        { $set: { supplierId: record._id } },
      );
      await StockItem.updateMany(
        { _id: { $in: g.stock.map((s) => s._id) } },
        { $set: { supplierId: record._id } },
      );
    }
  }

  console.log(`  ${purchases.length} purchases and ${stock.length} stock items had a typed supplier and no record.`);
  console.log(`  ${groups.size} distinct names.`);
  console.log(`    ${created} record${created === 1 ? "" : "s"} ${APPLY ? "created" : "would be created"}.`);
  console.log(`    ${reused} already on file — reused.`);
  console.log(
    `    ${linkedPurchases} purchases and ${linkedStock} stock items ${APPLY ? "linked" : "would be linked"}.`,
  );
  console.log(`    ${conflicts.length} could not be decided.\n`);

  if (conflicts.length > 0) {
    console.log("  Not touched — a person has to say which is right:\n");
    for (const line of conflicts.slice(0, 40)) console.log(`    ${line}`);
    if (conflicts.length > 40) console.log(`    …and ${conflicts.length - 40} more.`);
    console.log();
  }

  if (!APPLY) console.log("  Nothing written. Re-run with `-- --apply` when the list above looks right.\n");
  process.exit(0);
}

main().catch((error) => {
  console.error("\n  migrate-suppliers failed:", error, "\n");
  process.exit(1);
});
