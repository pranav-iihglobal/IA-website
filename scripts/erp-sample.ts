/**
 * Seed and wipe sample ERP data — invoices, stock and purchases.
 *
 *   npm run erp-sample -- seed        # ~60 invoices against sample contacts
 *   npm run erp-sample -- wipe
 *   npm run erp-sample -- doctor
 *
 * The real spreadsheets are NOT imported. This generates records with the same
 * shape so the invoice, GST, payments and dashboard screens can be exercised
 * without anything under test touching a real sale.
 *
 * Two safety properties, both structural rather than remembered:
 *
 *   1. Every document is written with `isSample: true`, and `wipe` deletes on
 *      that flag and nothing else.
 *   2. Sample invoices take their numbers from a SEPARATE series with an `SMP`
 *      prefix. Sharing the real counter would mean wiping them left permanent
 *      gaps in an issued GST sequence.
 *
 * Lines are self-contained snapshots, so this never writes a price or a rate
 * onto a real Product — those belong to the directors.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Contact } from "../lib/db/models/Contact";
import { Invoice } from "../lib/db/models/Invoice";
import { Counter } from "../lib/db/models/Counter";
import { StockItem } from "../lib/db/models/StockItem";
import { Purchase } from "../lib/db/models/Purchase";
import { computeInvoice, GUJARAT_STATE_CODE, supplyTypeFor } from "../lib/erp/tax";
import { financialYear, formatSampleInvoiceNumber } from "../lib/erp/invoice-number";
import { formatRupees } from "../lib/money";
import { buildStockItems, buildPurchases, SAMPLE_SKUS } from "./erp-sample-data";

loadEnv();

/** Deterministic enough to be reproducible, varied enough to look real. */
function pick<T>(list: T[], i: number): T {
  return list[i % list.length];
}

async function seedInvoices(count: number) {
  const parties = await Contact.find({ isSample: true, kind: "customer" })
    .select("name businessName phone village taluka district pin state channel dealer")
    .limit(200)
    .lean();

  if (parties.length === 0) {
    console.log(
      "\n  No sample customers to invoice. Run `npm run crm-sample -- seed` first.\n",
    );
    return 0;
  }

  // Spread across the last 14 months so the dashboard has something to compare
  // and a few customers age into At-Risk.
  const now = Date.now();
  const docs = [];

  for (let i = 0; i < count; i++) {
    const party = parties[i % parties.length];
    const issuedAt = new Date(now - Math.floor((i * 421) % 420) * 86_400_000);
    const isDealer = party.channel === "b2b";

    const lineCount = 1 + (i % 3);
    const lines = Array.from({ length: lineCount }, (_, n) => {
      const sku = pick(SAMPLE_SKUS, i + n);
      return {
        description: `${sku.name} — ${sku.pack}`,
        hsn: sku.hsn,
        quantity: 1 + ((i + n) % 12),
        unitPricePaise: isDealer ? sku.dealerPaise : sku.farmerPaise,
        discountPaise: 0,
        gstRateBps: sku.gstRateBps,
      };
    });

    // A few out-of-state sales so the IGST path is exercised too.
    const placeOfSupply = i % 11 === 0 ? "27" : GUJARAT_STATE_CODE;
    const supplyType = supplyTypeFor(GUJARAT_STATE_CODE, placeOfSupply);
    const computed = computeInvoice(lines, supplyType);

    /*
      Payment spread deliberately: most paid, some part-paid, some unpaid, so
      the outstanding view and the dashboard have something to show rather
      than a column of zeros.
    */
    const roll = i % 10;
    const payment =
      roll < 6
        ? { status: "paid", paidPaise: computed.grandTotalPaise }
        : roll < 8
          ? { status: "partial", paidPaise: Math.round(computed.grandTotalPaise / 2) }
          : { status: "unpaid", paidPaise: 0 };

    docs.push({
      number: formatSampleInvoiceNumber(issuedAt, i + 1),
      financialYear: financialYear(issuedAt),
      status: i % 23 === 0 ? "cancelled" : "issued",
      issuedAt,
      cancelledAt: i % 23 === 0 ? issuedAt : null,
      cancelledReason: i % 23 === 0 ? "Sample cancellation" : "",
      contactId: party._id,
      party: {
        name: party.name ?? "",
        businessName: party.businessName ?? "",
        gstin: party.dealer?.gstin ?? "",
        phone: party.phone ?? "",
        address: [party.village, party.taluka].filter(Boolean).join(", "),
        village: party.village ?? "",
        district: party.district ?? "",
        pin: party.pin ?? "",
        state: party.state ?? "Gujarat",
      },
      placeOfSupplyStateCode: placeOfSupply,
      supplyType,
      lines: computed.lines.map((l) => ({
        productId: null,
        description: l.description,
        packLabel: "",
        hsn: l.hsn,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        discountPaise: l.discountPaise ?? 0,
        gstRateBps: l.gstRateBps,
        taxableValuePaise: l.taxableValuePaise,
        cgstPaise: l.cgstPaise,
        sgstPaise: l.sgstPaise,
        igstPaise: l.igstPaise,
        lineTotalPaise: l.lineTotalPaise,
      })),
      subtotalPaise: computed.subtotalPaise,
      cgstPaise: computed.cgstPaise,
      sgstPaise: computed.sgstPaise,
      igstPaise: computed.igstPaise,
      totalTaxPaise: computed.totalTaxPaise,
      roundOffPaise: computed.roundOffPaise,
      grandTotalPaise: computed.grandTotalPaise,
      amountInWords: computed.amountInWords,
      payment: { ...payment, referenceNo: "", paidAt: payment.paidPaise ? issuedAt : null },
      isSample: true,
      createdBy: "erp-sample",
    });
  }

  await Invoice.insertMany(docs);
  return docs.length;
}

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }

  const mongoose = await connectToDatabase();

  if (command === "wipe") {
    const [inv, stock, buys, counters] = await Promise.all([
      Invoice.deleteMany({ isSample: true }),
      StockItem.deleteMany({ isSample: true }),
      Purchase.deleteMany({ isSample: true }),
      // Sample counters only — the real invoice series is never touched.
      Counter.deleteMany({ _id: /^sample-/ }),
    ]);
    console.log(
      `\n  Deleted ${inv.deletedCount} invoices, ${stock.deletedCount} stock items, ` +
        `${buys.deletedCount} purchases, ${counters.deletedCount} sample counters.`,
    );
    const realInvoices = await Invoice.countDocuments({ isSample: { $ne: true } });
    console.log(`  ${realInvoices} real invoices remain, untouched.`);

    // The other half of the sample set, so it is not forgotten about.
    const contacts = await Contact.countDocuments({ isSample: true });
    if (contacts > 0) {
      console.log(
        `\n  ${contacts} sample contact${contacts === 1 ? "" : "s"} are still there.` +
          `\n    Run: npm run crm-sample -- wipe`,
      );
    }
    console.log();
  } else if (command === "seed") {
    const count = Math.max(1, Number(arg) || 60);
    // Replaces the previous sample set rather than stacking on it.
    await Promise.all([
      Invoice.deleteMany({ isSample: true }),
      StockItem.deleteMany({ isSample: true }),
      Purchase.deleteMany({ isSample: true }),
    ]);

    const invoices = await seedInvoices(count);
    const stock = await StockItem.insertMany(buildStockItems());
    const purchases = await Purchase.insertMany(buildPurchases());

    console.log(
      `\n  Seeded ${invoices} invoices, ${stock.length} stock items, ` +
        `${purchases.length} purchases — all marked sample.\n`,
    );
  } else if (command === "doctor" || command === "count") {
    const [total, sample, real, unpaid, cancelled] = await Promise.all([
      Invoice.countDocuments({}),
      Invoice.countDocuments({ isSample: true }),
      Invoice.countDocuments({ isSample: { $ne: true } }),
      Invoice.countDocuments({ status: "issued", "payment.status": { $ne: "paid" } }),
      Invoice.countDocuments({ status: "cancelled" }),
    ]);

    const [{ owed = 0, billed = 0 } = {}] = await Invoice.aggregate<{
      owed: number;
      billed: number;
    }>([
      { $match: { status: "issued" } },
      {
        $group: {
          _id: null,
          billed: { $sum: "$grandTotalPaise" },
          owed: {
            $sum: { $subtract: ["$grandTotalPaise", { $ifNull: ["$payment.paidPaise", 0] }] },
          },
        },
      },
    ]);

    console.log(`\n  Database : ${mongoose.connection.name}`);
    console.log(`  Invoices : ${total}   (${sample} sample, ${real} real)`);
    console.log(`    issued but not fully paid   ${unpaid}`);
    console.log(`    cancelled                   ${cancelled}`);
    console.log(`  Billed   : ${formatRupees(billed)}`);
    console.log(`  Owed     : ${formatRupees(owed)}`);

    const [stock, purchases] = await Promise.all([
      StockItem.countDocuments({}),
      Purchase.countDocuments({}),
    ]);
    console.log(`  Stock    : ${stock} items`);
    console.log(`  Purchases: ${purchases}\n`);
  } else {
    console.log(
      "\n  Usage: npm run erp-sample -- seed [count] | wipe | doctor\n",
    );
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("\n  erp-sample failed:", error, "\n");
  process.exit(1);
});
