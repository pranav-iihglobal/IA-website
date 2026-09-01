import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import type { LeanDoc } from "@/lib/db/lean";
import { buildFilter } from "./filter";
import { toContactRow, type ContactRow } from "./shape";

/**
 * One page of a CRM list.
 *
 * Called from two places on purpose: the API route the browser talks to, and
 * the page itself, which renders the first page server-side so the rows arrive
 * in the HTML instead of after a second round trip. Two callers, one query —
 * if the page and the API built their own, they would eventually disagree, and
 * the list would change under you the moment you touched the search box.
 */

const PAGE_SIZE = 25;

/** The columns the list renders. Everything else stays on the server. */
const LIST_FIELDS =
  "contactId kind channel name businessName phone village taluka district region crop source owner followUpAt lastContactAt lead customer dealer isSample updatedAt updatedBy";

export interface ContactList {
  items: ContactRow[];
  total: number;
  /** How many of the matches are seeded test records. Shown while in beta. */
  sampleCount: number;
  page: number;
  pages: number;
  pageSize: number;
}

export async function listContacts(params: URLSearchParams): Promise<ContactList> {
  await connectToDatabase();

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const filter = buildFilter(params);

  const [items, counts] = await Promise.all([
    Contact.find(filter)
      .select(LIST_FIELDS)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    /*
      One pass for both numbers. This was two countDocuments() calls, which
      walk the same matches twice — cheap in wall-clock because they ran
      concurrently, but M0 is a shared, CPU-throttled tier where the second
      walk is not free.
    */
    Contact.aggregate<{ total: number; sample: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          sample: { $sum: { $cond: ["$isSample", 1, 0] } },
        },
      },
    ]),
  ]);

  // $group emits nothing at all when nothing matched.
  const { total = 0, sample = 0 } = counts[0] ?? {};

  return {
    items: (items as LeanDoc[]).map(toContactRow),
    total,
    sampleCount: sample,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    pageSize: PAGE_SIZE,
  };
}
