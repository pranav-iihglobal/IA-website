import type { LeanDoc } from "@/lib/db/lean";
import { searchRegex } from "@/lib/search";
import { statusFilter } from "./shape";

/**
 * The Mongo filter behind every CRM list, built from the query string.
 *
 * A pure function in its own file rather than a helper inside the route, so
 * it can be exercised without a server or a database — see
 * scripts/check-crm-filter.ts. The previous version lived in the route and
 * could not be checked, which is how a search that only matched whole words
 * reached the directors.
 */

/**
 * Fields a typed search looks at.
 *
 * contactId is here because the team searches by it — IKS-C-034 is printed on
 * documents — and taluka because it is on every row of their sheets and is
 * how people describe where someone is.
 */
const SEARCH_FIELDS = [
  "contactId",
  // The ids a converted lead used to carry. A regex against an array field
  // matches any element, so IKS-L-012 still finds the customer it became.
  "formerIds",
  "name",
  "nameGu",
  "businessName",
  "village",
  "taluka",
  "district",
  "crop",
] as const;

/** Long enough to be a phone number rather than a house number. */
const PHONE_MIN_DIGITS = 3;

export function buildFilter(params: URLSearchParams): LeanDoc {
  const filter: LeanDoc = {};

  const kind = params.get("kind");
  if (kind === "lead" || kind === "customer") filter.kind = kind;

  const channel = params.get("channel");
  if (channel === "b2c" || channel === "b2b") filter.channel = channel;

  const district = params.get("district");
  if (district) filter.district = district;

  const source = params.get("source");
  if (source) filter.source = source;

  const followUpStatus = params.get("followUpStatus");
  if (followUpStatus) filter["lead.followUpStatus"] = followUpStatus;

  // The "due" view: a follow-up date that has already passed.
  if (params.get("due") === "1") {
    filter.followUpAt = { $ne: null, $lte: new Date() };
  }

  // Active · at-risk · dormant · prospect, the same cut-offs deriveStatus()
  // uses to label a row, so the filter and the pill agree.
  const status = params.get("status");
  if (status) Object.assign(filter, statusFilter(status) ?? {});

  const search = (params.get("search") ?? "").trim();
  if (search) {
    const digits = search.replace(/[\s\-+()]/g, "");
    if (new RegExp(`^\\d{${PHONE_MIN_DIGITS},}$`).test(digits)) {
      /*
        Anchored, so the phone index serves it. Numbers are the one thing
        people do search from the start — nobody looks up a phone by its
        middle digits — so this branch loses nothing by being fast.
      */
      filter.phone = new RegExp(`^${digits}`);
    } else {
      /*
        A collection scan, and that is the right trade. Behind the kind and
        channel filter above, at a few thousand contacts it costs single-digit
        milliseconds; matching mid-word is what the search box is for. If this
        ever grows to where it hurts, the answer is Atlas Search, not the text
        index that was here before — that matched whole terms only, so typing
        "Kher" found nothing at all.
      */
      const rx = searchRegex(search);
      filter.$or = SEARCH_FIELDS.map((field) => ({ [field]: rx }));
    }
  }

  return filter;
}
