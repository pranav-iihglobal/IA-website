"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { SwipeRow } from "./SwipeRow";
import { RowMenu } from "./RowMenu";
import { useToast } from "./Toast";
import { adminFetch } from "@/lib/admin/fetch";
import {
  EmptyState,
  ErrorBanner,
  ListCard,
  Pagination,
  SearchInput,
  StatusPill,
  TableSkeleton,
} from "./ui";
import { useListState } from "./useListState";
import { listQueryKey } from "@/lib/crm/scopes";
import { formatRupees } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import type { SupplierList, SupplierRow } from "@/lib/erp/suppliers";

/**
 * Who IKSARVA buys from, with what each has been paid.
 *
 * The same shape as every other list: search and page in the URL, the first
 * page in the HTML, a fetch only for what the server has not answered.
 */
export function SupplierWorkspace({
  initial,
  initialQuery,
  canWrite,
  canDelete = false,
}: {
  initial: SupplierList;
  initialQuery?: string;
  canWrite: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<SupplierRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rows, setRows] = useState<SupplierRow[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [pages, setPages] = useState(initial.pages);
  const pageSize = initial.pageSize;
  const { search, setSearch, debounced, page, setPage } = useListState();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (debounced.trim()) q.set("search", debounced.trim());
    return q;
  }, [debounced, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/suppliers?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load suppliers");
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load suppliers");
    } finally {
      setLoading(false);
    }
  }, [query]);

  /*
    Refused when the supplier is on any bill or stock item (409) — the reason
    lands inside the dialog, where the person is looking.
  */
  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    const result = await adminFetch<{ ok: boolean }>(`/api/admin/suppliers/${deleting.id}`, { method: "DELETE" });
    setDeleteBusy(false);
    if (!result.ok) {
      setDeleteError(result.error ?? "Could not delete");
      return;
    }
    toast(`${deleting.name} deleted`);
    setDeleting(null);
    router.refresh();
    void load();
  }

  const alreadyServed = useRef(initialQuery ?? null);
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
            Suppliers
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">{total}</span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            Picked on every purchase and stock item, so a GSTIN is typed once.
          </p>
        </div>
        {canWrite && (
          <Link href="/admin/suppliers/new" className="admin-btn admin-btn-primary admin-tap">
            Add supplier
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, GSTIN, town" />
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {loading ? (
        <TableSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No suppliers"
          message={
            search
              ? "Nobody matches that. Clear the search."
              : "Add the first one, or run migrate-suppliers to create them from the bills already on file."
          }
          action={
            canWrite && !search ? (
              <Link href="/admin/suppliers/new" className="admin-btn admin-btn-primary admin-tap">
                Add supplier
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
                label={row.name}
                disabled={!canDelete}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleting(row);
                }}
                className="admin-bleed"
              >
              <ListCard
                as="div"
                title={
                  <Link href={`/admin/suppliers/${row.id}`} className="hover:text-cta hover:underline">
                    {row.name}
                  </Link>
                }
                subtitle={[row.gstin, row.city].filter(Boolean).join(" · ") || undefined}
                figure={formatRupees(row.totalPaise)}
                figureNote={`${row.purchases} bill${row.purchases === 1 ? "" : "s"}${
                  row.lastBillAt ? `, last ${formatIstDate(new Date(row.lastBillAt))}` : ""
                }`}
                pills={
                  !row.gstin || row.isSample ? (
                    <>
                      {!row.gstin && <span className="text-cta">no GSTIN — no input credit</span>}
                      {row.isSample && <StatusPill status="demo" />}
                    </>
                  ) : undefined
                }
                actions={
                  canWrite || canDelete ? (
                    <RowMenu
                      label={row.name}
                      items={[
                        { label: "Open", href: `/admin/suppliers/${row.id}` },
                        ...(canWrite ? [{ label: "Edit", href: `/admin/suppliers/${row.id}/edit` }] : []),
                        ...(canDelete
                          ? [
                              {
                                label: "Delete",
                                tone: "danger" as const,
                                onClick: () => {
                                  setDeleteError(null);
                                  setDeleting(row);
                                },
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : undefined
                }
              />
              </SwipeRow>
            ))}
          </ul>
          <Pagination page={page} pages={pages} total={total} pageSize={pageSize} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ""}?`}
        message="A supplier on any bill or stock item cannot be deleted — correct the record instead. One with nothing against it is simply removed."
        confirmLabel="Delete"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!deleteBusy) setDeleting(null);
        }}
      />
    </div>
  );
}
