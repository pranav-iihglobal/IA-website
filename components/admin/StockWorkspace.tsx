"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DownloadLink,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  Pagination,
  SortMenu,
  TableSkeleton,
  SearchInput,
  StatusPill,
  ListCard,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { formatRupees } from "@/lib/money";
import { useListState } from "./useListState";
import { STOCK_SORTS } from "@/lib/admin/sorts";
import { stockListQuery } from "@/lib/erp/inventory-query";
import { listQueryKey } from "@/lib/crm/scopes";
import type {
  ListEnvelope,
  StockRowShape,
  StockSummary,
} from "@/lib/erp/inventory-list";

/**
 * What is on the shelf.
 *
 * `onHand` is a counted number, not a derived one. Stock moves for reasons no
 * invoice records — a sample handed to a farmer, a bag split in transit, a
 * recount that found six more than the book said. See lib/db/models/StockItem.
 *
 * Recording a count is its own page — /admin/stock/new and /admin/stock/<id>
 * — rather than a dialog over this list. This screen is the list and its
 * figures; the form is a form.
 */

/**
 * The row shape now lives beside the query that produces it, so the page,
 * the route and this screen cannot drift. Re-exported because callers here
 * still refer to it by this name.
 */
export type StockRow = StockRowShape;

const KINDS = [
  { value: "finished", label: "Finished goods" },
  { value: "packaging", label: "Packaging" },
  { value: "raw", label: "Raw material" },
];

const FILTERS = [
  { value: "", label: "All" },
  { value: "low", label: "Needs ordering" },
  ...KINDS.map((k) => ({ value: k.value, label: k.label })),
];

/** Mirrors needsReorder() in the model. A level of 0 never alerts. */
function low(row: { onHand: number; reorderLevel: number }): boolean {
  return row.reorderLevel > 0 && row.onHand <= row.reorderLevel;
}


export function StockWorkspace({
  initial,
  initialQuery,
  canWrite,
  canDelete,
}: {
  initial: ListEnvelope<StockRow, StockSummary>;
  /** The query the server already ran, so the first render skips a fetch. */
  initialQuery?: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial.items);
  /*
    The company-wide figures, from an aggregation over every item rather than
    from the rows on screen. They used to be a sum of a capped, searched list
    presented as a company total — see lib/erp/inventory-list.ts.
  */
  const [summary, setSummary] = useState(initial.summary);
  const [total, setTotal] = useState(initial.total);
  const [pages, setPages] = useState(initial.pages);
  const pageSize = initial.pageSize;
  /*
    Search, filter, sort and page live in the URL — see useListState. The
    filter used to be applied here in the browser to a capped list, so
    "Needs ordering" could miss a low item that was not in the first 500 by
    name. It goes to the server with everything else now.
  */
  const { search, setSearch, debounced, filter, setFilter, sort, setSort, page, setPage } =
    useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StockRow | null>(null);

  const query = useMemo(
    () => stockListQuery({ search: debounced, filter, sort, page }),
    [debounced, filter, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const res = await fetch(`/api/admin/stock?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load stock");
      setRows(data.items);
      setTotal(data.total ?? data.items.length);
      setPages(data.pages ?? 1);
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stock");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // The server already answered the untouched first query — see
  // ContactWorkspace. Spent after one use, so coming back re-fetches.
  const alreadyServed = useRef(initial ? initialQuery : null);
  useEffect(() => {
    if (alreadyServed.current === listQueryKey(query)) {
      alreadyServed.current = null;
      return;
    }
    void load();
  }, [load, query]);

  const lowCount = summary.lowCount;
  const stockValue = summary.valuePaise;

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stock/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.name} deleted`);
      setDeleting(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not delete";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Stock
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {summary.items}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            {formatRupees(stockValue)} at cost
            {lowCount > 0 && (
              <span className="text-cta"> · {lowCount} need ordering</span>
            )}
          </p>
        </div>
        {canWrite && (
          /* A link, not a button: the form is a page now, so it should
             middle-click, open in a tab and prefetch like any other. */
          <Link href="/admin/stock/new" className="admin-btn admin-btn-primary admin-tap">
            Add item
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, SKU, supplier" />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
        <SortMenu value={sort} onChange={setSort} options={STOCK_SORTS} />
        <DownloadLink href={`/api/admin/stock?${query}&format=csv`} />
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/*
        Rows only. ListPageSkeleton draws a page header, a search box and
        a filter strip — all three of which are already on screen above
        this, so every debounced search painted a second copy of them.
      */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nothing here"
          message={
            filter || search
              ? "No items match this filter. Try another, or clear the search."
              : "Add the first item."
          }
          action={
            canWrite && !filter && !search ? (
              <Link href="/admin/stock/new" className="admin-btn admin-btn-primary admin-tap">
                Add item
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <ListCard
              key={row.id}
              title={
                /* Opens the record. "Count" below goes straight to the form,
                   because that is the frequent act — but the count HISTORY
                   is only on the record. */
                <Link href={`/admin/stock/${row.id}`} className="hover:text-cta hover:underline">
                  {row.name}
                </Link>
              }
              subtitle={[row.sku, row.supplier].filter(Boolean).join(" · ") || undefined}
              figure={
                <>
                  {row.onHand} <span className="text-sm font-semibold">{row.unit}</span>
                </>
              }
              figureTone={low(row) ? "danger" : undefined}
              figureNote={row.reorderLevel > 0 ? `reorder at ${row.reorderLevel}` : "no reorder level"}
              pills={
                <>
                  <StatusPill status={row.kind} />
                  {low(row) && <StatusPill status="unpaid" />}
                </>
              }
              actions={
                canWrite || canDelete ? (
                  <>
                    {canWrite && (
                      <Link
                        href={`/admin/stock/${row.id}/edit`}
                        className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
                      >
                        Count
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => setDeleting(row)}
                        aria-label={`Delete ${row.name}`}
                        className="admin-tap-square rounded-full p-2 text-ink-soft hover:bg-danger/12 hover:text-danger"
                      >
                        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                          <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
                        </svg>
                      </button>
                    )}
                  </>
                ) : undefined
              }
            />
          ))}
        </ul>
        <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="Stock items can be deleted outright — unlike an invoice, nothing was filed."
        confirmLabel="Delete"
        busy={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
