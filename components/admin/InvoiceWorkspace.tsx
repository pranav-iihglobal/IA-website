"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BetaStar,
  EmptyState,
  ErrorBanner,
  DownloadLink,
  FilterTabs,
  SortMenu,
  ViewToggle,
  ListCard,
  TableSkeleton,
  Pagination,
  SearchInput,
  StatusPill,
} from "./ui";
import { formatINR } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { listQueryKey } from "@/lib/crm/scopes";
import { invoiceListQuery } from "@/lib/erp/list-query";
import { INVOICE_SORTS } from "@/lib/admin/sorts";
import type { InvoiceList, InvoiceRow } from "@/lib/erp/list";
import { useListState } from "./useListState";
import { useViewMode } from "./useViewMode";

/**
 * The invoices screen.
 *
 * Deliberately the same shape as ContactWorkspace — list, URL-driven state,
 * server-rendered first page, first fetch skipped when the server already
 * answered. A second layout for the same job would be a second thing to keep
 * consistent.
 *
 * There is no EDIT. An issued invoice is a record of what was filed; the
 * model refuses a financial change regardless of what any screen asks for. The
 * only things a row offers are recording a payment, cancelling, crediting, and
 * printing — and each of those is its own page now, under
 * /admin/invoices/<id>/…, rather than a dialog over this list. Raising one is
 * /admin/invoices/new.
 *
 * Cancelling and crediting are not the same act and the screen does not blur
 * them. Cancel voids the whole document; a credit note leaves it standing and
 * reverses part of it, which is what a correction to something already filed
 * has to look like.
 */

const FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
  { value: "credit_notes", label: "Credit notes" },
  { value: "samples", label: "Samples" },
];

const isCredit = (row: InvoiceRow) => row.documentType === "credit_note";
const isSampleNote = (row: InvoiceRow) => row.documentType === "sample_note";

export function InvoiceWorkspace({
  initialData,
  initialQuery,
  canWrite,
  canCancel,
  /** The module's beta note, if it has one. Renders a star beside the title. */
  beta,
}: {
  initialData?: InvoiceList;
  initialQuery?: string;
  canWrite: boolean;
  canCancel: boolean;
  beta?: string | null;
}) {
  const [rows, setRows] = useState<InvoiceRow[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [pages, setPages] = useState(initialData?.pages ?? 1);
  // Fixed server-side; kept here only so the range line can say "26–50 of 412".
  const pageSize = initialData?.pageSize ?? 25;
  // Search, filter and page live in the URL — see useListState.
  const { search, setSearch, debounced, filter, setFilter, sort, setSort, page, setPage } =
    useListState();
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  // Cards or a table, remembered on this device. Cards on a phone regardless.
  const [view, setView] = useViewMode("invoices");

  const query = useMemo(
    () => invoiceListQuery({ search: debounced, filter, sort, page }),
    [debounced, filter, sort, page],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load invoices");
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // The server already answered the untouched first page — see ContactWorkspace.
  const alreadyServed = useRef(initialData ? initialQuery : null);
  useEffect(() => {
    if (alreadyServed.current === listQueryKey(query)) {
      alreadyServed.current = null;
      return;
    }
    void load();
  }, [load, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Invoices
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {total}
            </span>
            {/* Same star as the sidebar, so the two say one thing. */}
            {beta && (
              <BetaStar note={beta} className="ml-1.5 align-middle text-base text-alloy" />
            )}
          </h1>
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Free goods to a prospect: a Sample note, not a tax invoice. */}
            <Link
              href="/admin/samples/new"
              className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive"
            >
              Give a sample
            </Link>
            <Link href="/admin/invoices/new" className="admin-btn admin-btn-primary admin-tap">
              Raise invoice
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search number or customer"
        />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
        <SortMenu value={sort} onChange={setSort} options={INVOICE_SORTS} />
        <DownloadLink href={`/api/admin/invoices?${query}&format=csv`} />
        <ViewToggle value={view} onChange={setView} />
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {/*
        Rows only. ListPageSkeleton draws a page header, a search box and
        a filter strip — all three of which are already on screen above
        this, so every debounced search painted a second copy of them.
      */}
      {loading ? (
        <TableSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={debounced || filter ? "Nothing matches" : "No invoices yet"}
          message={
            debounced || filter
              ? "Try a different search or clear the filter."
              : "Raise the first one. Products need a GST rate and an HSN code first."
          }
        />
      ) : (
        <>
        <ul
          className={`admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 ${
            view === "table" ? "lg:hidden" : ""
          }`}
        >
          {rows.map((row) => (
            <ListCard
              key={row.id}
              title={
                /* The number opens the record, not the printable document.
                   Print is one tap away below, and the two are different
                   things: one is the paperwork, the other is what has
                   happened to it since. */
                <Link href={`/admin/invoices/${row.id}`} className="hover:text-cta hover:underline">
                  {row.number || "(no number)"}
                </Link>
              }
              subtitle={`${row.partyName}${row.gstin ? ` · ${row.gstin}` : ""}`}
              figure={isSampleNote(row) ? "free" : formatINR(row.grandTotalPaise)}
              pills={
                <>
                  {isCredit(row) ? (
                    <StatusPill status="credit note" />
                  ) : isSampleNote(row) ? (
                    <StatusPill status="sample note" />
                  ) : (
                    <>
                      <StatusPill status={row.status} />
                      <StatusPill status={row.paymentStatus} />
                    </>
                  )}
                  {(isCredit(row) || isSampleNote(row)) && row.status === "cancelled" && <StatusPill status="cancelled" />}
                  {row.isHistorical && <StatusPill status="filed" />}
                  <span className="text-ink-faint">
                    {row.issuedAt ? formatIstDate(new Date(row.issuedAt)) : "not issued"}
                  </span>
                  {isCredit(row) && row.againstNumber && (
                    <span className="text-ink-faint">credits {row.againstNumber}</span>
                  )}
                </>
              }
              actions={<InvoiceActions row={row} canWrite={canWrite} canCancel={canCancel} />}
            />
          ))}
        </ul>
        {view === "table" && (
          <InvoiceTable rows={rows} canWrite={canWrite} canCancel={canCancel} />
        )}
        </>
      )}

      <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onChange={setPage}
          />

    </div>
  );
}

/**
 * The row's actions, once, for the card and the table.
 *
 * Print is always there. Payment, Credit and Cancel need an issued, real,
 * non-credit document and the right permission — the same four conditions
 * in one place, so the table cannot offer a Cancel the card would not.
 */
function InvoiceActions({
  row,
  canWrite,
  canCancel,
}: {
  row: InvoiceRow;
  canWrite: boolean;
  canCancel: boolean;
}) {
  // Payment and Credit: a real, issued SALE. Cancel: any issued document.
  const live = !row.isHistorical && !isCredit(row) && !isSampleNote(row) && row.status === "issued";
  const cancellable = !row.isHistorical && row.status === "issued";
  const pill =
    "admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive";
  return (
    <>
      <Link href={`/admin/invoices/${row.id}/print`} className={pill}>
        Print
      </Link>
      {canWrite && live && (
        <Link href={`/admin/invoices/${row.id}/payment`} className={pill}>
          Payment
        </Link>
      )}
      {canWrite && live && (
        <Link href={`/admin/invoices/${row.id}/credit-note`} className={pill}>
          Credit
        </Link>
      )}
      {canCancel && cancellable && (
        <Link
          href={`/admin/invoices/${row.id}/cancel`}
          className="admin-tap inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-danger/12 hover:text-danger"
        >
          Cancel
        </Link>
      )}
    </>
  );
}

/**
 * The same rows as a table, from `lg` up.
 *
 * Forty rows on a monitor where the cards show a dozen, and money in one
 * column so it can be scanned. Scrolls inside its own container like the
 * People table — the page must never scroll sideways.
 */
function InvoiceTable({
  rows,
  canWrite,
  canCancel,
}: {
  rows: InvoiceRow[];
  canWrite: boolean;
  canCancel: boolean;
}) {
  const th = "px-4 py-3 font-semibold";
  const td = "px-4 py-2.5 align-top";
  return (
    <div className="admin-card hidden overflow-hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-accent">
            <tr>
              <th className={th}>Number</th>
              <th className={th}>Customer</th>
              <th className={th}>Date</th>
              <th className={th}>Status</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={`${th} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="admin-row border-t border-line-soft/25">
                <td className={`${td} whitespace-nowrap font-semibold text-ink-strong`}>
                  <Link href={`/admin/invoices/${row.id}`} className="hover:text-cta hover:underline">
                    {row.number || "(no number)"}
                  </Link>
                  {isCredit(row) && row.againstNumber && (
                    <p className="text-xs font-normal text-ink-faint">credits {row.againstNumber}</p>
                  )}
                </td>
                <td className={`${td} max-w-[18rem]`}>
                  <p className="truncate text-ink">{row.partyName}</p>
                  {row.gstin && <p className="text-xs text-ink-faint">{row.gstin}</p>}
                </td>
                <td className={`${td} whitespace-nowrap text-ink-muted`}>
                  {row.issuedAt ? formatIstDate(new Date(row.issuedAt)) : "not issued"}
                </td>
                <td className={td}>
                  <span className="flex flex-wrap gap-1.5 text-xs">
                    {isCredit(row) ? (
                      <StatusPill status="credit note" />
                    ) : isSampleNote(row) ? (
                      <StatusPill status="sample note" />
                    ) : (
                      <>
                        <StatusPill status={row.status} />
                        <StatusPill status={row.paymentStatus} />
                      </>
                    )}
                    {(isCredit(row) || isSampleNote(row)) && row.status === "cancelled" && <StatusPill status="cancelled" />}
                    {row.isHistorical && <StatusPill status="filed" />}
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums text-ink-strong`}>
                  {isSampleNote(row) ? "free" : formatINR(row.grandTotalPaise)}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    <InvoiceActions row={row} canWrite={canWrite} canCancel={canCancel} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
