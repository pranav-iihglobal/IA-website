/**
 * The orders each list can be asked for.
 *
 * LABELS ONLY, and no imports. The workspaces are client components and
 * need the labels for the menu; the Mongo sort specs live beside each query
 * in lib/crm/list.ts and lib/erp/*, which pull in Mongoose and cannot reach
 * the browser bundle. The two halves share the VALUES, and
 * lib/admin/sorts.test.ts asserts every label here has a spec there — the
 * drift that would otherwise show up as a menu entry that silently sorts by
 * the default.
 *
 * The first entry of every list is the default and has the empty value, so
 * it never appears in the URL (useListState strips "").
 *
 * WHITELISTED, never spliced: a sort key read from a URL is looked up in one
 * of these before it reaches a query. Every filter in this panel is
 * whitelisted the same way, and `.sort(params.get("sort"))` would be the one
 * place that trusted what a URL said.
 */

export interface SortOption {
  value: string;
  label: string;
}

export const CONTACT_SORTS: SortOption[] = [
  { value: "", label: "Recently updated" },
  { value: "newest", label: "Newest first" },
  { value: "name", label: "Name A–Z" },
  // Newest last order first; contacts who never ordered sort to the end.
  { value: "last-order", label: "Last order" },
  { value: "district", label: "District" },
];

export const INVOICE_SORTS: SortOption[] = [
  { value: "", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "amount", label: "Biggest first" },
  { value: "party", label: "Customer A–Z" },
];

export const STOCK_SORTS: SortOption[] = [
  { value: "", label: "Name A–Z" },
  // Furthest below its reorder level first — the "what do I order" order.
  { value: "low", label: "Lowest first" },
  { value: "on-hand", label: "Most on hand" },
  { value: "value", label: "Highest value" },
];

export const PURCHASE_SORTS: SortOption[] = [
  { value: "", label: "Newest bill" },
  { value: "oldest", label: "Oldest bill" },
  { value: "amount", label: "Biggest first" },
  { value: "supplier", label: "Supplier A–Z" },
];

/** The value if it is one of the options, else the default. */
export function sortKey(options: SortOption[], value: string | null | undefined): string {
  return options.some((o) => o.value === value) ? (value as string) : "";
}
