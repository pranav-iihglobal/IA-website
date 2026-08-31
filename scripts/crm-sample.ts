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
    console.log(`  ${remaining} contacts remain (none of them sample).\n`);
  } else if (command === "count") {
    const [sample, real] = await Promise.all([
      Contact.countDocuments({ isSample: true }),
      Contact.countDocuments({ isSample: { $ne: true } }),
    ]);
    console.log(`\n  sample ${sample}\n  real   ${real}\n`);
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
        "    npm run crm-sample -- count\n",
    );
  }

  await mongoose.connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
