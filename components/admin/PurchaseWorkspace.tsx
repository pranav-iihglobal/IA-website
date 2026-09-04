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
import { SwipeRow } from "./SwipeRow";
import { RowMenu } from "./RowMenu";
// One list of categories, shared with the form that writes them.
import { PURCHASE_CATEGORIES, purchaseCategoryLabel } from "@/lib/erp/purchase-categories";
import { useToast } from "./Toast";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { useListState } from "./useListState";
import { PURCHASE_SORTS } from "@/lib/admin/sorts";
import { purchaseListQuery } from "@/lib/erp/inventory-query";
import { listQueryKey } from "@/lib/crm/scopes";
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
  // Then by category, so the Sales overview's lines land on a lit pill.
  ...PURCHASE_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];


export function PurchaseWorkspace({
  initial,
  initialQuery,
  canWrite,
  canDelete,
}: {
  initial: ListEnvelope<PurchaseRow, PurchaseSummary>;
  /** The query the server already ran, so the first render skips a fetch. */
  initialQuery?: string;
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
  const [pages, setPages] = useState(initial.pages);
  const pageSize = initial.pageSize;
  // Search, filter, sort and page live in the URL — see useListState. The
  // filter used to be applied here to a capped list; it goes to the server.
  const { search, setSearch, debounced, filter, setFilter, sort, setSort, page, setPage } =
    useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<PurchaseRow | null>(null);

  const query = useMemo(
    () => purchaseListQuery({ search: debounced, filter, sort, page }),
    [debounced, filter, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    // Cleared here, like every other list. Without it one failed search left
    // the red banner on screen until a full page reload.
    setError(null);
    try {
      const res = await fetch(`/api/admin/purchases?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load purchases");
      setRows(data.items);
      setTotal(data.total ?? data.items.length);
      setPages(data.pages ?? 1);
      if (data.summary) setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load purchases");
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

  const creditable = summary.creditablePaise;

  /*
    What the company owes its directors. Not an accounting figure — the CA
    decides what it becomes — but a number nobody should have to reconstruct
    from memory, which is what happens when personal spending is recorded
    nowhere.
  */
  const owedToDirectors = summary.owedToDirectorsPaise;

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/purchases/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete");
      toast(`${deleting.supplier} deleted`);
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
        <SortMenu value={sort} onChange={setSort} options={PURCHASE_SORTS} />
        <DownloadLink href={`/api/admin/purchases?${query}&format=csv`} />
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
        <>
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <SwipeRow
              key={row.id}
              label={`bill from ${row.supplier}`}
              disabled={!canDelete}
              onDelete={() => setDeleting(row)}
              className="admin-bleed"
            >
            <ListCard
              as="div"
              title={
                <Link href={`/admin/purchases/${row.id}`} className="hover:text-cta hover:underline">
                  {row.supplier}
                </Link>
              }
              subtitle={row.description || row.billNo || undefined}
              figure={formatINR(row.totalPaise)}
              figureNote={`GST ${formatRupees(row.cgstPaise + row.sgstPaise + row.igstPaise)}`}
              pills={
                <>
                  <StatusPill status={row.paymentStatus} />
                  <span className="text-ink-faint">{purchaseCategoryLabel(row.category)}</span>
                  {row.billDate && (
                    <span className="text-ink-faint">{formatIstDate(new Date(row.billDate))}</span>
                  )}
                  {row.paidBy === "director" && (
                    <span className="text-cta">paid by {row.paidByName || "a director"}</span>
                  )}
                  {!row.supplierGstin && <span className="text-cta">no GSTIN — no input credit</span>}
                </>
              }
              actions={
                <>
                  {canWrite && (
                    <Link
                      href={`/admin/purchases/${row.id}/edit`}
                      className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Edit
                    </Link>
                  )}
                  <RowMenu
                    label={`bill from ${row.supplier}`}
                    items={[
                      { label: "Open", href: `/admin/purchases/${row.id}` },
                      ...(canWrite ? [{ label: "Edit", href: `/admin/purchases/${row.id}/edit` }] : []),
                      ...(canDelete
                        ? [{ label: "Delete", tone: "danger" as const, onClick: () => setDeleting(row) }]
                        : []),
                    ]}
                  />
                </>
              }
            />
            </SwipeRow>
          ))}
        </ul>
        <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onChange={setPage} />
        </>
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
