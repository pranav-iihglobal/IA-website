/**
 * What a list URL asks for, as an API query.
 *
 * Its own file, with no database imports, because a CLIENT component needs it
 * too: lib/erp/list.ts pulls in the Mongoose models, and importing that from
 * the browser bundle fails the build.
 */

/**
 * The API query one invoice list is, from what the URL says.
 *
 * ONE definition, shared by the page that server-renders the first screen and
 * the workspace that fetches every screen after it — the same reasoning as
 * contactListQuery() in lib/crm/scopes.ts.
 */
export function invoiceListQuery({
  search = "",
  filter = "",
  sort = "",
  page = 1,
}: { search?: string; filter?: string; sort?: string; page?: number } = {}): URLSearchParams {
  const query = new URLSearchParams({ page: String(Math.max(1, page)) });
  if (search) query.set("search", search);
  if (sort) query.set("sort", sort);
  if (filter === "cancelled") query.set("status", "cancelled");
  else if (filter === "credit_notes") query.set("kind", "credit_note");
  else if (filter === "samples") query.set("kind", "sample_note");
  else if (filter) query.set("payment", filter);
  return query;
}
