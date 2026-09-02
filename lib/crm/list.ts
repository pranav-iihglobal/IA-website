import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import type { LeanDoc } from "@/lib/db/lean";
import { CONTACT_SORTS, sortKey } from "@/lib/admin/sorts";
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

/**
 * The Mongo sort for each key in CONTACT_SORTS (lib/admin/sorts.ts).
 *
 * `_id` as the final tie-break on every one, so paging is stable: two
 * contacts updated in the same second must not swap places between page 2
 * and page 3. "last-order" is descending so contacts who never ordered —
 * a null date — fall to the end rather than the front.
 */
export const CONTACT_SORT_SPECS: Record<string, Record<string, 1 | -1>> = {
  "": { updatedAt: -1, _id: 1 },
  name: { name: 1, _id: 1 },
  "last-order": { "customer.lastOrderAt": -1, updatedAt: -1, _id: 1 },
  district: { district: 1, name: 1, _id: 1 },
};

export async function listContacts(params: URLSearchParams): Promise<ContactList> {
  await connectToDatabase();

  const page = Math.max(1, Number(params.get("page") ?? 1));
  const filter = buildFilter(params);
  const sort = CONTACT_SORT_SPECS[sortKey(CONTACT_SORTS, params.get("sort"))];

  const [items, counts] = await Promise.all([
    Contact.find(filter)
      .select(LIST_FIELDS)
      .sort(sort)
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
