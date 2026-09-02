/**
 * What a Stock or Purchases URL asks for, as an API query.
 *
 * Client-safe, like lib/erp/list-query.ts: lib/erp/inventory-list.ts pulls
 * in the Mongoose models and cannot be imported by the workspaces.
 *
 * The filter used to be applied in the browser, to whatever 500 rows had
 * come down — so "Needs ordering" was only right if every low item happened
 * to be in the first 500 by name, and the header count and the rows could
 * disagree. It goes to the server now, with the search, the sort and the
 * page, and the list is paged rather than capped.
 */

export interface InventoryListParams {
  search?: string;
  filter?: string;
  sort?: string;
  page?: number;
}

function inventoryQuery({
  search = "",
  filter = "",
  sort = "",
  page = 1,
}: InventoryListParams): URLSearchParams {
  const query = new URLSearchParams({ page: String(Math.max(1, page)) });
  if (search) query.set("search", search);
  if (filter) query.set("filter", filter);
  if (sort) query.set("sort", sort);
  return query;
}

export function stockListQuery(params: InventoryListParams = {}): URLSearchParams {
  return inventoryQuery(params);
}

export function purchaseListQuery(params: InventoryListParams = {}): URLSearchParams {
  return inventoryQuery(params);
}
