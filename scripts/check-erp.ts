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

  // A failed write must not block the change it describes.
  let threw = false;
  try {
    // @ts-expect-error deliberately invalid — actor is required.
    await recordAudit({ action: "create", entity: ENTITY, entityId: id });
  } catch {
    threw = true;
  }
  check("an invalid entry is logged, not thrown", !threw);

  console.log("\n  Cleaning up\n");
  const removedCounters = await Counter.deleteMany({ _id: SERIES });
  const removedAudits = await AuditLog.deleteMany({ entity: ENTITY });
  check(
    "the test series and rows are gone",
    removedCounters.deletedCount === 1 && removedAudits.deletedCount >= 2,
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
