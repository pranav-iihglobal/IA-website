"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EmptyState,
  ErrorBanner,
  FilterTabs,
  TableSkeleton,
  SearchInput,
  StatusPill,
} from "./ui";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { formatRupees } from "@/lib/money";
import { useListState } from "./useListState";
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
  canWrite,
  canDelete,
}: {
  initial: ListEnvelope<StockRow, StockSummary>;
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
  const [capped, setCapped] = useState(initial.capped);
  // Search and filter live in the URL, so a search can be shared — see
  // useListState. There is no paging here; the list is capped instead.
  const { search, setSearch, debounced, filter, setFilter } = useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<StockRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const q = new URLSearchParams();
      if (debounced.trim()) q.set("search", debounced.trim());
      const res = await fetch(`/api/admin/stock?${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load stock");
      setRows(data.items);
      setTotal(data.total ?? data.items.length);
      setCapped(Boolean(data.capped));
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load stock");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  // Only re-fetch when a search is actually typed; the first page came down
  // with the HTML.
  /*
    Skip only the FIRST run — the initial rows came down with the HTML.

    This used to bail on an empty search instead, which meant clearing the box
    never reloaded: `rows` kept the last search's subset, and every headline
    figure on this screen is computed from `rows`. The count in the header, the
    stock value, the low-stock count, the input-credit total and the money owed
    to directors were all recomputed from a handful of matches and presented as
    company-wide totals.
  */
  const servedInitial = useRef(true);
  useEffect(() => {
    if (servedInitial.current) {
      servedInitial.current = false;
      return;
    }
    void load();
  }, [debounced, load]);

  const shown = useMemo(() => {
    if (filter === "low") return rows.filter(low);
    if (filter) return rows.filter((r) => r.kind === filter);
    return rows;
  }, [rows, filter]);

  const lowCount = summary.lowCount;
  const stockValue = summary.valuePaise;

  async function reload() {
    const res = await fetch("/api/admin/stock", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).items);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/stock/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.name} deleted`);
      setDeleting(null);
      await reload();
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
            {/*
              Said, not silent. The list is capped for the screen and the
              figures above are not — so when the two disagree the screen has
              to explain itself rather than look like it lost rows.
            */}
            {capped && (
              <span className="text-ink-faint">
                {" · showing "}
                {rows.length} of {total}
              </span>
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
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/*
        Rows only. ListPageSkeleton draws a page header, a search box and
        a filter strip — all three of which are already on screen above
        this, so every debounced search painted a second copy of them.
      */}
      {loading ? (
        <TableSkeleton rows={4} />
      ) : shown.length === 0 ? (
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
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {shown.map((row) => (
            <li
              key={row.id}
              className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-strong">
                    {/* Opens the record. "Count" beside it goes straight to
                        the form, because that is the frequent act — but the
                        count HISTORY is only on the record. */}
                    <Link
                      href={`/admin/stock/${row.id}`}
                      className="hover:text-cta hover:underline"
                    >
                      {row.name}
                    </Link>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                    {row.sku && <span>{row.sku}</span>}
                    <StatusPill status={row.kind} />
                    {low(row) && <StatusPill status="unpaid" />}
                    {row.supplier && <span>{row.supplier}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={`font-display text-lg font-bold tabular-nums ${
                        low(row) ? "text-danger" : "text-ink-strong"
                      }`}
                    >
                      {row.onHand} <span className="text-sm font-semibold">{row.unit}</span>
                    </p>
                    <p className="text-xs text-ink-faint">
                      {row.reorderLevel > 0
                        ? `reorder at ${row.reorderLevel}`
                        : "no reorder level"}
                    </p>
                  </div>
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
                </div>
              </div>
            </li>
          ))}
        </ul>
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
