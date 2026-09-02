"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BetaStar,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  TableSkeleton,
  Pagination,
  SearchInput,
  StatusPill,
} from "./ui";
import { formatINR } from "@/lib/money";
import { listQueryKey } from "@/lib/crm/scopes";
import { invoiceListQuery } from "@/lib/erp/list-query";
import type { InvoiceList, InvoiceRow } from "@/lib/erp/list";
import { useListState } from "./useListState";

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
];

const isCredit = (row: InvoiceRow) => row.documentType === "credit_note";

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
  const { search, setSearch, debounced, filter, setFilter, page, setPage } =
    useListState();
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => invoiceListQuery({ search: debounced, filter, page }),
    [debounced, filter, page],
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
          <Link href="/admin/invoices/new" className="admin-btn admin-btn-primary admin-tap">
            Raise invoice
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search number or customer"
        />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
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
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-strong">
                    {row.number || "(no number)"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {row.partyName}
                    {row.gstin ? ` · ${row.gstin}` : ""}
                  </p>
                  {isCredit(row) && row.againstNumber && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      credits {row.againstNumber}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {isCredit(row) ? (
                      <StatusPill status="credit note" />
                    ) : (
                      <>
                        <StatusPill status={row.status} />
                        <StatusPill status={row.paymentStatus} />
                      </>
                    )}
                    {isCredit(row) && row.status === "cancelled" && (
                      <StatusPill status="cancelled" />
                    )}
                    {row.isHistorical && <StatusPill status="filed" />}
                    <span className="text-ink-faint">
                      {row.issuedAt
                        ? new Date(row.issuedAt).toLocaleDateString("en-IN")
                        : "not issued"}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold tabular-nums text-ink-strong">
                    {formatINR(row.grandTotalPaise)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    <Link
                      href={`/admin/invoices/${row.id}/print`}
                      className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Print
                    </Link>
                    {canWrite && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
                      <Link
                        href={`/admin/invoices/${row.id}/payment`}
                        className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                      >
                        Payment
                      </Link>
                    )}
                    {canWrite && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
                      <Link
                        href={`/admin/invoices/${row.id}/credit-note`}
                        className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                      >
                        Credit
                      </Link>
                    )}
                    {canCancel && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
                      <Link
                        href={`/admin/invoices/${row.id}/cancel`}
                        className="admin-tap inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-danger/12 hover:text-danger"
                      >
                        Cancel
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
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
