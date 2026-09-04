/**
 * The ERP groundwork checks that need a real database.
 *
 *   npm run check-erp
 *
 * Everything else about money, GST and invoice numbering is a pure function
 * and is covered by `npm test`, which needs nothing. Two properties cannot be
 * proved that way, and they are the two that matter most:
 *
 *   1. Invoice numbers are ATOMIC. Two people raising an invoice in the same
 *      second must not get the same number. That guarantee lives inside
 *      MongoDB's findOneAndUpdate, not in our code, so only a real server can
 *      demonstrate it.
 *   2. The audit log is APPEND-ONLY and its writes survive.
 *
 * Nothing here touches invoices, contacts or any real collection. It writes to
 * counter series and audit rows prefixed `selftest:`, and deletes exactly
 * those at the end.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Counter, nextInSeries, peekSeries, raiseSeriesTo } from "../lib/db/models/Counter";
import { AuditLog, recordAudit } from "../lib/db/models/AuditLog";
import { Invoice } from "../lib/db/models/Invoice";
import { StockItem } from "../lib/db/models/StockItem";
import { formatIstDate, istParts } from "../lib/time";
import { parseInvoiceNumber } from "../lib/erp/invoice-number";

loadEnv();

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.log(`  ${passed ? "✓" : "✗"} ${label}`);
  if (!passed) {
    failures++;
    if (detail) console.log(`      ${detail}`);
  }
}

/** A series nothing else uses, so a failed run cannot corrupt real numbering. */
const SERIES = `selftest:${Date.now()}`;
const ENTITY = "SelfTest";

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }

  await connectToDatabase();
  console.log("\n  Invoice numbering — the guarantee that matters\n");

  /*
    Fifty callers at once, which is far more concurrency than two directors
    will ever produce, precisely because a race that only shows up under load
    is still a race.
  */
  const CONCURRENT = 50;
  const numbers = await Promise.all(
    Array.from({ length: CONCURRENT }, () => nextInSeries(SERIES)),
  );
  const unique = new Set(numbers);
  const sorted = [...numbers].sort((a, b) => a - b);

  check(
    `${CONCURRENT} simultaneous callers get ${CONCURRENT} different numbers`,
    unique.size === CONCURRENT,
    `got ${unique.size} distinct values — a duplicate invoice number`,
  );
  check(
    "they start at 1 and run consecutively — no gaps",
    sorted[0] === 1 && sorted[CONCURRENT - 1] === CONCURRENT,
    `range ${sorted[0]}..${sorted[CONCURRENT - 1]}`,
  );
  check(
    "peeking does not consume a number",
    (await peekSeries(SERIES)) === CONCURRENT &&
      (await peekSeries(SERIES)) === CONCURRENT,
  );

  console.log("\n  Seeding from the historical import\n");

  await raiseSeriesTo(SERIES, 500);
  check("raising the counter moves it forward", (await peekSeries(SERIES)) === 500);

  await raiseSeriesTo(SERIES, 3);
  check(
    "and can NEVER move it backwards onto numbers already issued",
    (await peekSeries(SERIES)) === 500,
    "re-running the import would have reissued numbers 4..500",
  );
  check("the next number continues from there", (await nextInSeries(SERIES)) === 501);

  console.log("\n  Audit log\n");

  const id = `selftest-${Date.now()}`;
  await recordAudit({
    actor: "check-erp@iksarva.com",
    action: "create",
    entity: ENTITY,
    entityId: id,
    after: { note: "first" },
  });
  await recordAudit({
    actor: "check-erp@iksarva.com",
    action: "update",
    entity: ENTITY,
    entityId: id,
    before: { note: "first" },
    after: { note: "second" },
  });

  const entries = await AuditLog.find({ entity: ENTITY, entityId: id })
    .sort({ createdAt: 1 })
    .lean();

  check("both entries were written", entries.length === 2, `found ${entries.length}`);
  check(
    "a correction is a new entry, not an edit of the old one",
    entries[0]?.action === "create" && entries[1]?.action === "update",
  );
  check(
    "entries are stamped with who and when",
    Boolean(entries[0]?.actor) && entries[0]?.createdAt instanceof Date,
  );
  check(
    "there is no updatedAt, because nothing is ever updated",
    entries[0] !== undefined && !("updatedAt" in entries[0]),
  );

  /*
    A failed audit write must not block the change it describes — refusing to
    save an invoice because the log was unreachable would turn a bookkeeping
    nicety into an outage.

    Proving that means causing a real failure, and recordAudit is built to
    shout about those. The error printed next is the point of the test, not a
    problem with it, so say so first — an unannounced stack trace in the
    middle of a passing run reads exactly like a failure.
  */
  console.log("    ↓ the next few lines are a DELIBERATE failure ↓");
  let threw = false;
  try {
    // @ts-expect-error deliberately invalid — actor is required.
    await recordAudit({ action: "create", entity: ENTITY, entityId: id });
  } catch {
    threw = true;
  }
  console.log("    ↑ deliberate ↑");
  check("an invalid entry is logged, not thrown", !threw);

  console.log("\n  An issued invoice is locked\n");

  /*
    lib/db/models/Invoice.test.ts already proves the RULE — which paths an
    issued invoice must refuse. It cannot prove the rule is actually WIRED to
    a save, because a save hook needs a server. That is what this does, and it
    is the difference between a correct function and a correct system.
  */
  const invoice = await Invoice.create({
    number: `SELFTEST.${Date.now()}`,
    status: "issued",
    issuedAt: new Date(),
    party: { name: "check-erp" },
    lines: [
      {
        description: "Self test",
        quantity: 1,
        unitPricePaise: 10000,
        gstRateBps: 500,
        taxableValuePaise: 10000,
        lineTotalPaise: 10500,
      },
    ],
    grandTotalPaise: 10500,
    notes: "created by check-erp",
  });

  invoice.grandTotalPaise = 1;
  let locked = false;
  let message = "";
  try {
    await invoice.save();
  } catch (error) {
    locked = true;
    message = error instanceof Error ? error.message : String(error);
  }
  check("changing a total on an issued invoice is refused", locked, "IT SAVED");
  check(
    "and the refusal says what was wrong",
    message.includes("grandTotalPaise"),
    message || "(no message)",
  );

  /*
    Re-read rather than reusing the rejected document: a failed save leaves
    the in-memory copy holding the change it could not write, and asserting
    against that would prove nothing about what is actually stored.
  */
  const stored = await Invoice.findById(invoice._id).lean();
  check("and the stored figure is untouched", stored?.grandTotalPaise === 10500);

  const payable = await Invoice.findById(invoice._id);
  payable!.payment = {
    status: "paid",
    paidPaise: 10500,
    referenceNo: "SELFTEST",
    paidAt: new Date(),
  };
  let paymentSaved = true;
  try {
    await payable!.save();
  } catch {
    paymentSaved = false;
  }
  check(
    "but recording a payment still works, because money arrives later",
    paymentSaved,
  );

  /*
    Every real invoice already issued, checked against the timezone fix.

    Reported, never rewritten — the same rule the historical import follows. A
    number is printed on a document and filed; if one disagrees with its own
    issue date, that is the CA's to resolve, and silently correcting it would
    misrepresent what was sent.
  */
  console.log("\n  Invoice numbers against their issue date (IST)\n");
  const issued = await Invoice.find({
    isSample: { $ne: true },
    isHistorical: { $ne: true },
    number: { $ne: "" },
    issuedAt: { $ne: null },
  })
    .select("number issuedAt")
    .lean();

  const mismatched = issued.filter((doc) => {
    const parsed = /\.(\d{2})\.(\d{2})\./.exec(doc.number ?? "");
    if (!parsed || !doc.issuedAt) return false;
    const { year, month } = istParts(new Date(doc.issuedAt));
    return Number(parsed[1]) !== month || Number(parsed[2]) !== year % 100;
  });

  check(
    `every issued number matches its date in IST (${issued.length} checked)`,
    mismatched.length === 0,
    mismatched
      .map((d) => `${d.number} was issued ${formatIstDate(new Date(d.issuedAt!))} IST`)
      .join("; "),
  );
  if (mismatched.length > 0) {
    console.log(
      "\n    These were numbered before the timezone fix, in the 00:00–05:30 IST\n" +
        "    window where the server's UTC clock was still on the previous month.\n" +
        "    Raise them with the CA. Nothing here rewrites a filed number.\n",
    );
  }

  /*
    Gaps in the issued series.

    A number is allocated and THEN the document is written; if that write
    fails, the counter has already moved and the series has a permanent hole.
    M0 has no transactions, so this cannot be made atomic — but it can be
    noticed, and a missing number in a filed GST sequence is a question from
    the department rather than a cosmetic flaw.

    Reported, never filled in. Inventing a document to plug a gap would be
    considerably worse than the gap.
  */
  console.log("\n  Gaps in the invoice series\n");
  const numbered = await Invoice.find({
    isSample: { $ne: true },
    isHistorical: { $ne: true },
    documentType: { $ne: "credit_note" },
    number: { $ne: "" },
  })
    .select("number")
    .lean();

  const bySeries = new Map<string, number[]>();
  for (const doc of numbered) {
    const parsed = parseInvoiceNumber(doc.number ?? "");
    if (!parsed) continue;
    const key = `${parsed.year}-${String(parsed.month).padStart(2, "0")}`;
    bySeries.set(key, [...(bySeries.get(key) ?? []), parsed.sequence]);
  }

  const gaps: string[] = [];
  for (const [key, sequences] of bySeries) {
    const seen = new Set(sequences);
    for (let n = 1; n <= Math.max(...sequences); n++) {
      if (!seen.has(n)) gaps.push(`${key} #${String(n).padStart(3, "0")}`);
    }
  }
  check(
    `no missing numbers across ${bySeries.size} month series`,
    gaps.length === 0,
    gaps.join(", "),
  );

  /*
    Perpetual stock rests on one guarded update: `onHand >= q` in the filter
    of the same updateOne that decrements. lib/erp/stock-moves.test.ts proves
    the plan; only a server can prove that fifty callers racing for thirty
    pieces get exactly thirty and the rest are refused, not that the shelf
    goes negative.
  */
  console.log("\n  Stock — the guarded decrement\n");
  const shelf = await StockItem.create({
    name: `SELFTEST shelf ${Date.now()}`,
    sku: "SELFTEST",
    kind: "finished",
    unit: "piece",
    onHand: 30,
  });
  const attempts = await Promise.all(
    Array.from({ length: CONCURRENT }, () =>
      StockItem.updateOne({ _id: shelf._id, onHand: { $gte: 1 } }, { $inc: { onHand: -1 } }),
    ),
  );
  const taken = attempts.filter((r) => r.modifiedCount === 1).length;
  const left = (await StockItem.findById(shelf._id).select("onHand").lean())?.onHand;
  check(
    `${CONCURRENT} callers racing for 30 pieces: exactly 30 succeed`,
    taken === 30,
    `${taken} succeeded`,
  );
  check("and the shelf reads 0, never negative", left === 0, `onHand is ${left}`);

  console.log("\n  Cleaning up\n");
  const removedShelves = await StockItem.deleteMany({ sku: "SELFTEST" });
  const removedCounters = await Counter.deleteMany({ _id: SERIES });
  const removedAudits = await AuditLog.deleteMany({ entity: ENTITY });
  // deleteOne on the collection, not the document: the model refuses changes
  // to an issued invoice, and this row has no business surviving the run.
  const removedInvoices = await Invoice.deleteMany({ number: /^SELFTEST\./ });
  check(
    "the test series, rows, invoice and shelf are gone",
    removedCounters.deletedCount === 1 &&
      removedAudits.deletedCount >= 2 &&
      removedInvoices.deletedCount >= 1 &&
      removedShelves.deletedCount >= 1,
  );

  console.log(
    failures === 0
      ? "\n  All checks passed.\n"
      : `\n  ${failures} check${failures === 1 ? "" : "s"} failed.\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\n  check-erp failed to run:", error, "\n");
  process.exit(1);
});
