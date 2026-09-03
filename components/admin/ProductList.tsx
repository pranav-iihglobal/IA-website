"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CLD, cldUrl } from "@/lib/images";
import { adminFetch } from "@/lib/admin/fetch";
import { formatShortDate } from "@/lib/format";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  EmptyState,
  ErrorBanner,
  FilterTabs,
  Pagination,
  RecordCard,
  RowActions,
  SearchInput,
  StatusPill,
  ListBody,
  TableSkeleton,
} from "./ui";

interface Row {
  id: string;
  name: { en: string; gu?: string };
  slug: string;
  status: string;
  featured: boolean;
  categoryLabel: { en: string; gu?: string };
  image: string | null;
  availability: string;
  updatedAt: string;
  updatedBy: string;
}

const AVAILABILITY: Record<string, { label: string; className: string }> = {
  in_stock: { label: "In stock", className: "bg-accent-soft/60 text-ink-muted" },
  out_of_stock: { label: "Out of stock", className: "bg-surface-strong/50 text-ink-strong" },
  seasonal: { label: "Seasonal", className: "bg-alloy/15 text-cta" },
};

function AvailabilityBadge({ value }: { value: string }) {
  const style = AVAILABILITY[value] ?? AVAILABILITY.in_stock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

/** Pack shot, or a sprout when there is no image yet. */
function Thumb({ image }: { image: string | null }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-muted ring-1 ring-line-soft/50">
      {image ? (
        <Image
          src={cldUrl(image, CLD.thumb) ?? image}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-12 w-12 object-cover"
        />
      ) : (
        <span className="text-lg text-ink-faint">🌱</span>
      )}
    </div>
  );
}

/** "Last edited" line: date plus who saved it, when known. */
function lastEdited(row: Row): string {
  const when = formatShortDate(row.updatedAt);
  if (!when) return "";
  return row.updatedBy ? `${when} · ${row.updatedBy}` : when;
}

export function ProductList({
  initialStatus = "",
}: {
  /** From the URL, so a dashboard link can land on the drafts. */
  initialStatus?: string;
} = {}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const result = await adminFetch<{
        items: Row[];
        total: number;
        pages: number;
        pageSize?: number;
      }>(`/api/admin/products?${params}`);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not load products");
        return;
      }
      setRows(result.data.items);
      setTotal(result.data.total);
      if (result.data.pageSize) setPageSize(result.data.pageSize);
      setPages(result.data.pages);
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await adminFetch(`/api/admin/products/${pending.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!result.ok) {
      /*
        The dialog STAYS OPEN and says why. Closing it on failure threw away
        the row being deleted, so the only way to find out what went wrong was
        to hunt the record down and try again.
      */
      setDeleteError(result.error ?? "Could not delete the product");
      toast(result.error ?? "Could not delete the product", "error");
      return;
    }
    toast(`“${pending.name.en}” deleted`);
    setPending(null);
    load();
  }

  const filtering = Boolean(search || status);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search name, slug or SKU…"
        />
        <FilterTabs
          value={status}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
          options={[
            { value: "", label: "All" },
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
          ]}
        />
        <span className="text-sm text-ink-soft">
          {loading ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <ErrorBanner message={error} onRetry={() => void load()} />

      {loading && rows.length === 0 && <TableSkeleton />}

      {!loading && rows.length === 0 && !error && (
        <EmptyState
          title={filtering ? "No matching products" : "No products yet"}
          message={
            filtering ? (
              "Try a different search term or clear the status filter."
            ) : (
              <>
                Run <code className="rounded bg-surface-subtle px-1.5 py-0.5">npm run seed</code>{" "}
                to import the existing products, or add your first one.
              </>
            )
          }
          action={
            !filtering && (
              <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
                Add a product
              </Link>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <ListBody busy={loading} className="mt-6">
          {/* Cards below lg, table from lg up. A five-column table cannot be
              read on a phone; a card fits every field the table shows. */}
          <ul className="admin-rows grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((row) => (
              <RecordCard
                key={row.id}
                thumb={<Thumb image={row.image} />}
                title={row.name.en}
                subtitle={`/${row.slug}`}
                badges={
                  <>
                    <StatusPill status={row.status} />
                    <AvailabilityBadge value={row.availability} />
                    {row.categoryLabel?.en && (
                      <span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-ink-muted">
                        {row.categoryLabel.en}
                      </span>
                    )}
                    {row.featured && (
                      <span className="rounded-full bg-alloy/15 px-2.5 py-1 text-xs font-semibold text-cta">
                        Featured
                      </span>
                    )}
                  </>
                }
                meta={lastEdited(row) ? `Last edited ${lastEdited(row)}` : undefined}
                editHref={`/admin/products/${row.id}`}
                onDelete={() => setPending(row)}
                label={row.name.en}
              />
            ))}
          </ul>

          <div className="admin-card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-accent">
                <tr>
                  <th className="px-5 py-3 font-semibold">Product</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Stock</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="admin-row border-t border-line-soft/25"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Thumb image={row.image} />
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 font-semibold text-ink-strong">
                            <span className="truncate">{row.name.en}</span>
                            {row.featured && (
                              <span
                                title="Featured on the home page"
                                className="shrink-0 rounded-full bg-alloy/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cta"
                              >
                                Featured
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-ink-soft">
                            /{row.slug}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink">
                      {row.categoryLabel?.en}
                    </td>
                    <td className="px-5 py-3.5">
                      <AvailabilityBadge value={row.availability} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={row.status} />
                      {lastEdited(row) && (
                        <p
                          className="mt-1 truncate text-[11px] text-ink-soft"
                          title={`Last edited ${lastEdited(row)}`}
                        >
                          {lastEdited(row)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions
                        editHref={`/admin/products/${row.id}`}
                        onDelete={() => setPending(row)}
                        label={row.name.en}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </ListBody>
      )}

      <Pagination
        page={page}
        pages={pages}
        total={total}
        pageSize={pageSize}
        onChange={setPage}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        busy={deleting}
        title="Delete this product?"
        message={`“${pending?.name.en ?? ""}” will be removed from the website along with its uploaded images. This cannot be undone.`}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPending(null);
          setDeleteError(null);
        }}
      />
    </div>
  );
}
