/**
 * The three CRM lists, and the query each one is.
 *
 * Customers, dealers and leads are one collection filtered three ways. That
 * mapping used to live inside ContactWorkspace, which is a client component —
 * fine while the browser was the only thing that ran the query. The pages now
 * render the first page on the server, so both sides need it, and it has to be
 * one definition or the two will disagree about what a "dealer" is.
 */

export type Scope = "customers" | "dealers" | "leads";

const CUSTOMER_STATUS_FILTERS = new Set(["active", "at_risk", "dormant", "prospect"]);
/** Given a sample and not yet bought — a stored stage, not a derived status. */
const SAMPLE_STAGE_FILTER = "sample";

export const SCOPE_QUERY: Record<Scope, Record<string, string>> = {
  customers: { kind: "customer", channel: "b2c" },
  dealers: { kind: "customer", channel: "b2b" },
  leads: { kind: "lead" },
};

/** What a list URL says, once the defaults are taken out of it. */
export interface ListParams {
  search?: string;
  filter?: string;
  /** A key from lib/admin/sorts.ts; "" or absent for the list's default. */
  sort?: string;
  page?: number;
}

/**
 * The API query one CRM list is, from the scope and what the URL says.
 *
 * ONE definition, used by the page that server-renders the first screen and
 * by the workspace that fetches every screen after it. Two copies would work
 * until somebody changed a filter name, and then the server would render one
 * set of rows and the browser would immediately replace them with another.
 */
export function contactListQuery(
  scope: Scope,
  { search = "", filter = "", sort = "", page = 1 }: ListParams = {},
): URLSearchParams {
  const query = new URLSearchParams({
    ...SCOPE_QUERY[scope],
    page: String(Math.max(1, page)),
  });
  if (search) query.set("search", search);
  if (sort) query.set("sort", sort);
  // "due" is a date comparison, not a stored status — hence its own flag.
  if (filter === "due") query.set("due", "1");
  // A customer's standing, derived from the last order date — see shape.ts.
  else if (CUSTOMER_STATUS_FILTERS.has(filter)) query.set("status", filter);
  else if (filter === SAMPLE_STAGE_FILTER) query.set("stage", "sample");
  else if (filter) query.set("followUpStatus", filter);
  return query;
}

/**
 * A canonical string for one list query.
 *
 * The client uses it to recognise the query the server already ran, so it can
 * skip a redundant fetch on mount. Sorted rather than raw, because insertion
 * order is not something two files should have to agree on by accident — that
 * would work until someone reordered a field and quietly reintroduced the
 * extra round trip this exists to avoid.
 */
export function listQueryKey(params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(sorted).toString();
}

/**
 * Which list a contact belongs to, from the record itself.
 *
 * The inverse of SCOPE_QUERY. The profile page serves all three kinds from one
 * route, so it has to work out which scope a record is in order to show the
 * right form — a lead needs the sample pipeline, a dealer needs GSTIN and
 * credit terms.
 *
 * Derived rather than passed in the URL, so a link to a contact cannot claim
 * the wrong kind and get a form that does not match the record.
 */
export function scopeFor(kind: string, channel: string): Scope {
  if (kind === "lead") return "leads";
  return channel === "b2b" ? "dealers" : "customers";
}
