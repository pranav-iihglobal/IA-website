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
// One list of categories, shared with the form that writes them.
import { PURCHASE_CATEGORIES } from "./PurchaseForm";
import { useToast } from "./Toast";
import { formatINR, formatRupees } from "@/lib/money";
import { useListState } from "./useListState";
import type {
  ListEnvelope,
  PurchaseRowShape,
  PurchaseSummary,
} from "@/lib/erp/inventory-list";

/**
 * What IKSARVA bought, and the GST paid on it.
 *
 * Nothing here is computed. The totals are transcribed from the supplier's
 * bill exactly as printed — if their arithmetic disagrees with ours, theirs is
 * the one that was filed. The form does add the parts up and SAY so when they
 * do not match, which is a different thing from silently correcting them.
 *
 * The form is its own page — /admin/purchases/new and /admin/purchases/<id>.
 * Sixteen fields was the widest thing in the panel and it lived in a dialog.
 */

/**
 * The row shape lives beside the query that produces it, so the page, the
 * route and this screen cannot drift. Re-exported under the old name.
 */
export type PurchaseRow = PurchaseRowShape;

const FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "credit", label: "Input credit" },
  { value: "director", label: "Paid by a director" },
];


export function PurchaseWorkspace({
  initial,
  canWrite,
  canDelete,
}: {
  initial: ListEnvelope<PurchaseRow, PurchaseSummary>;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState(initial.items);
  /*
    Company-wide, from an aggregation over every purchase rather than from
    the rows on screen. Input credit and money owed to the directors were a
    sum of a capped, searched list presented as a company total — see
    lib/erp/inventory-list.ts.
  */
  const [summary, setSummary] = useState(initial.summary);
  const [total, setTotal] = useState(initial.total);
  const [capped, setCapped] = useState(initial.capped);
  // Search and filter live in the URL — see useListState.
  const { search, setSearch, debounced, filter, setFilter } = useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PurchaseRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const q = new URLSearchParams();
      if (debounced.trim()) q.set("search", debounced.trim());
      const res = await fetch(`/api/admin/purchases?${q}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load purchases");
      setRows(data.items);
      setTotal(data.total ?? data.items.length);
      setCapped(Boolean(data.capped));
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load purchases");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

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
    if (filter === "unpaid") return rows.filter((r) => r.paymentStatus !== "paid");
    if (filter === "credit") return rows.filter((r) => r.inputCreditEligible);
    if (filter === "director") return rows.filter((r) => r.paidBy === "director");
    return rows;
  }, [rows, filter]);

  const creditable = summary.creditablePaise;

  /*
    What the company owes its directors. Not an accounting figure — the CA
    decides what it becomes — but a number nobody should have to reconstruct
    from memory, which is what happens when personal spending is recorded
    nowhere.
  */
  const owedToDirectors = summary.owedToDirectorsPaise;

  async function reload() {
    const res = await fetch("/api/admin/purchases", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).items);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/purchases/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.supplier} deleted`);
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
            Purchases
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {summary.count}
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            {formatRupees(creditable)} input credit on eligible bills
            {owedToDirectors > 0 && (
              <span className="text-cta">
                {" · "}
                {formatRupees(owedToDirectors)} paid by directors, owed back
              </span>
            )}
            {/* Purchases grow forever; the list is capped and says so. */}
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
          <Link href="/admin/purchases/new" className="admin-btn admin-btn-primary admin-tap">
            Add purchase
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier, bill, description" />
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
          /*
            It used to say there were no purchases while the header said 47.
            A filter that matches nothing is a different fact from an empty
            ledger, and conflating them reads as a broken screen.
          */
          message={
            filter || search
              ? "No purchases match this filter. Try another, or clear the search."
              : "Add the first purchase."
          }
          action={
            canWrite && !filter && !search ? (
              <Link href="/admin/purchases/new" className="admin-btn admin-btn-primary admin-tap">
                Add purchase
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
                    {row.supplier}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {row.description || row.billNo}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status={row.paymentStatus} />
                    <span className="text-ink-faint">
                      {PURCHASE_CATEGORIES.find((c) => c.value === row.category)?.label ?? row.category}
                    </span>
                    {row.billDate && (
                      <span className="text-ink-faint">
                        {new Date(row.billDate).toLocaleDateString("en-IN")}
                      </span>
                    )}
                    {row.paidBy === "director" && (
                      <span className="text-cta">
                        paid by {row.paidByName || "a director"}
                      </span>
                    )}
                    {!row.supplierGstin && (
                      <span className="text-cta">no GSTIN — no input credit</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-display text-lg font-bold tabular-nums text-ink-strong">
                      {formatINR(row.totalPaise)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      GST {formatRupees(row.cgstPaise + row.sgstPaise + row.igstPaise)}
                    </p>
                  </div>
                  {canWrite && (
                    <Link
                      href={`/admin/purchases/${row.id}`}
                      className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Edit
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleting(row)}
                      aria-label={`Delete ${row.supplier}`}
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
        title={`Delete this bill from ${deleting?.supplier ?? ""}?`}
        message="A purchase record can be deleted — it is a copy of somebody else's document, not one we issued."
        confirmLabel="Delete"
        busy={saving}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
