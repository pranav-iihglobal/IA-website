/**
 * Seed and wipe sample CRM data.
 *
 *   npm run crm-sample -- seed          # ~500 contacts, the default
 *   npm run crm-sample -- seed 5000     # match real volume, to test search
 *   npm run crm-sample -- wipe
 *   npm run crm-sample -- count
 *
 * The real spreadsheets are NOT imported. This generates records with the
 * same shape — the same districts, regions, ID formats and pipeline states —
 * so the screens can be built and tested without anything under test being
 * able to touch a real customer.
 *
 * Every document is written with `isSample: true`, and `wipe` deletes on that
 * flag and nothing else. That is the whole safety property: once real data
 * does arrive, the wipe still cannot take a real record with it.
 */
import { loadEnv } from "./load-env";
import { connectToDatabase } from "../lib/db/connect";
import { Contact } from "../lib/db/models/Contact";
import { Invoice } from "../lib/db/models/Invoice";
import { peekSeries } from "../lib/db/models/Counter";
import {
  contactSeriesKey,
  isAllocatedSeries,
  parseContactId,
  type ContactSeriesLetter,
} from "../lib/crm/contact-id";
import { buildContacts } from "./crm-sample-data";

loadEnv();

async function main() {
  const [command, arg] = process.argv.slice(2);

  if (!process.env.MONGODB_URI) {
    console.error("\n  MONGODB_URI is not set. Copy .env.example to .env.local.\n");
    process.exit(1);
  }

  const mongoose = await connectToDatabase();

  if (command === "wipe") {
    const { deletedCount } = await Contact.deleteMany({ isSample: true });
    console.log(`\n  Deleted ${deletedCount} sample contacts.`);
    const remaining = await Contact.countDocuments({});
    console.log(`  ${remaining} contacts remain (none of them sample).`);

    /*
      Told, not cascaded.

      Sample invoices point at sample contacts, so wiping only this side leaves
      invoices whose customer no longer exists — nothing is lost, but the
      profile pages break in a way that looks like a defect. Deleting across
      scripts silently would be worse: a command called "wipe contacts" should
      not quietly remove invoices.
    */
    const orphans = await Invoice.countDocuments({ isSample: true });
    if (orphans > 0) {
      console.log(
        `\n  ⚠ ${orphans} sample invoice${orphans === 1 ? "" : "s"} now point at ` +
          `deleted contacts.\n    Run: npm run erp-sample -- wipe`,
      );
    }
    console.log();
  } else if (command === "count" || command === "doctor") {
    /*
      Answers "why is the list empty" without guessing: it reports what the
      collection actually holds, broken down by the exact filters the three
      admin screens use, plus any leftover index that is no longer used.
    */
    const q: [string, Record<string, string>][] = [
      ["Customers  (kind=customer, channel=b2c)", { kind: "customer", channel: "b2c" }],
      ["Dealers    (kind=customer, channel=b2b)", { kind: "customer", channel: "b2b" }],
      ["Leads      (kind=lead)", { kind: "lead" }],
    ];
    const [total, sample, real] = await Promise.all([
      Contact.countDocuments({}),
      Contact.countDocuments({ isSample: true }),
      Contact.countDocuments({ isSample: { $ne: true } }),
    ]);

    console.log(`\n  Database : ${mongoose.connection.name}`);
    console.log(`  Contacts : ${total}   (${sample} sample, ${real} real)\n`);

    if (total === 0) {
      console.log("  The collection is EMPTY — that is why every screen shows nothing.");
      console.log("  Seed it with:  npm run crm-sample -- seed 500\n");
    } else {
      for (const [label, filter] of q) {
        console.log(`  ${label.padEnd(42)} ${await Contact.countDocuments(filter)}`);
      }
      const stale = await Contact.countDocuments({ kind: "customer", channel: "" });
      if (stale > 0) {
        console.log(`\n  ${stale} customers have no channel set — those appear on NEITHER`);
        console.log("  the Customers nor the Dealers screen. Set channel to b2c or b2b.");
      }

      await contactIdReport();
    }

    /*
      The text index is no longer used — search is a regex now, because a text
      index matches whole words and nobody types whole words into a search
      box. Mongoose never drops an index it stopped declaring, so on any
      cluster seeded before that change one is still sitting there, costing
      writes and serving nothing. Reported rather than dropped: this runs
      against the live cluster, and surprise surgery on someone else's
      database is not this script's call.
    */
    const indexes = await Contact.collection.indexes();
    const staleIndexes = indexes.filter((i) => Object.values(i.key).includes("text"));
    if (staleIndexes.length > 0) {
      console.log("\n  Leftover text index — unused since search moved to regex.");
      console.log("  Harmless, but it slows every write. Drop it when convenient:");
      for (const index of staleIndexes) {
        console.log(`    db.contacts.dropIndex("${index.name}")`);
      }
    }
    console.log();
  } else if (command === "seed") {
    const total = Math.max(1, Number(arg) || 500);
    // Replaces the previous sample set rather than stacking on it, so running
    // seed twice does not silently double the list.
    await Contact.deleteMany({ isSample: true });
    const docs = buildContacts(total);
    await Contact.insertMany(docs, { ordered: false });
    const dealers = docs.filter((d) => d.channel === "b2b").length;
    const customers = docs.filter((d) => d.channel === "b2c").length;
    console.log(
      `\n  Seeded ${docs.length} sample contacts:\n` +
        `    ${docs.length - dealers - customers} leads\n` +
        `    ${customers} customers\n` +
        `    ${dealers} dealers\n\n` +
        `  All marked isSample. Remove with: npm run crm-sample -- wipe\n`,
    );
  } else {
    console.log(
      "\n  Usage:\n" +
        "    npm run crm-sample -- seed [count]   default 500\n" +
        "    npm run crm-sample -- wipe\n" +
        "    npm run crm-sample -- doctor      what is actually in the database\n",
    );
  }

  await mongoose.connection.close();
}

/**
 * Contact ids: are they unique, is the index there, are the counters ahead
 * of what has been typed by hand?
 *
 * Reported, never repaired. Every line here is a change to somebody else's
 * database, and the right moment for each is a decision, not a side effect
 * of asking what is in it.
 */
async function contactIdReport() {
  console.log("\n  Contact ids");

  const blank = await Contact.countDocuments({
    isSample: { $ne: true },
    $or: [{ contactId: "" }, { contactId: null }],
  });
  if (blank > 0) {
    console.log(`    ${blank} real contacts have no id yet — each is allocated one on its next save.`);
  }

  const duplicates = await Contact.aggregate<{ _id: string; count: number }>([
    { $match: { contactId: { $type: "string", $gt: "" } } },
    { $group: { _id: "$contactId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { _id: 1 } },
    { $limit: 40 },
  ]);
  if (duplicates.length > 0) {
    console.log(`    ⚠ ${duplicates.length} ids are on more than one contact:`);
    for (const d of duplicates) console.log(`      ${d._id}  ×${d.count}`);
    console.log("    The unique index cannot be built until these are resolved by hand.");
  }

  /*
    Sample contacts numbered before the prefix changed to SMP- still hold
    IKS- ids, and the unique index does not care which are sample: the first
    real dealer allocated IKS-B-001 collides with the sample one and the
    save is refused. Found on the live cluster, not reported by this
    script, which counted real ids only.
  */
  const staleSample = await Contact.countDocuments({
    isSample: true,
    contactId: { $regex: /^(?!SMP-)/, $gt: "" },
  });
  if (staleSample > 0) {
    console.log(`    ⚠ ${staleSample} sample contacts carry real-looking ids (not SMP-). A real`);
    console.log("      contact allocated the same number cannot be saved. Re-seed, in this order:");
    console.log("        npm run crm-sample -- seed 500");
    console.log("        npm run erp-sample -- seed");
  }

  const indexes = await Contact.collection.indexes();
  const unique = indexes.find((i) => i.name === "contactId_unique_when_set");
  if (!unique) {
    console.log("    ⚠ The unique index on contactId is not on this cluster. Mongoose creates");
    console.log("      it on first connect only when nothing conflicts. Build it with:");
    console.log(
      '      db.contacts.createIndex({ contactId: 1 }, { unique: true, name: "contactId_unique_when_set",',
    );
    console.log('        partialFilterExpression: { contactId: { $type: "string", $gt: "" } } })');
  }

  /*
    A counter behind the highest id already typed would hand out a number
    that is taken. Compare each real series against the ids on file.
  */
  const ids = (await Contact.find({ isSample: { $ne: true }, contactId: { $gt: "" } })
    .select("contactId")
    .lean()) as { contactId?: string }[];
  const highest: Record<ContactSeriesLetter, number> = { C: 0, B: 0, L: 0 };
  for (const doc of ids) {
    const parsed = parseContactId(doc.contactId ?? "");
    if (parsed && isAllocatedSeries(parsed)) {
      highest[parsed.letter] = Math.max(highest[parsed.letter], parsed.sequence);
    }
  }
  for (const letter of ["C", "B", "L"] as const) {
    const at = await peekSeries(contactSeriesKey(letter));
    const line = `    ${contactSeriesKey(letter).padEnd(12)} counter ${at}, highest on file ${highest[letter]}`;
    if (at < highest[letter]) {
      console.log(`${line}  ⚠ BEHIND — the next allocation would reuse an id.`);
      console.log(`      Seed it: db.counters.updateOne({ _id: "${contactSeriesKey(letter)}" }, { $max: { seq: ${highest[letter]} } }, { upsert: true })`);
    } else {
      console.log(line);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
