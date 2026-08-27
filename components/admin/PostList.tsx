"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CLD, cldUrl } from "@/lib/images";
import { adminFetch } from "@/lib/admin/fetch";
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
  TableSkeleton,
} from "./ui";

interface Row {
  id: string;
  title: { en: string; gu?: string };
  slug: string;
  status: string;
  category: string;
  tags: string[];
  publishAt: string | null;
  cover: string | null;
  readingTime: number;
}

/** Cover thumbnail, or a page glyph when the post has none. */
function Cover({ cover }: { cover: string | null }) {
  return (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-meringue-light ring-1 ring-camel-light/50">
      {cover ? (
        <Image
          src={cldUrl(cover, CLD.thumb) ?? cover}
          alt=""
          width={64}
          height={48}
          unoptimized
          className="h-12 w-16 object-cover"
        />
      ) : (
        <span className="text-base text-camel">📄</span>
      )}
    </div>
  );
}

/** Publish date with the year, e.g. "1 Aug 2026". */
function formatLongDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PostList() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      }>(`/api/admin/posts?${params}`);
      if (!result.ok || !result.data) {
        setError(result.error ?? "Could not load");
        return;
      }
      setRows(result.data.items);
      setTotal(result.data.total);
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
    const result = await adminFetch(`/api/admin/posts/${pending.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!result.ok) {
      toast(result.error ?? "Could not delete the post", "error");
      setPending(null);
      return;
    }
    toast(`“${pending.title.en}” deleted`);
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
          placeholder="Search title or slug…"
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
            { value: "scheduled", label: "Scheduled" },
            { value: "draft", label: "Draft" },
          ]}
        />
        <span className="text-sm text-russet-dark/55">
          {loading ? "Loading…" : `${total} post${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <ErrorBanner message={error} />

      {loading && rows.length === 0 && <TableSkeleton />}

      {!loading && rows.length === 0 && !error && (
        <EmptyState
          title={filtering ? "No matching posts" : "No posts yet"}
          message={
            filtering ? (
              "Try a different search term or clear the status filter."
            ) : (
              <>
                Run <code className="rounded bg-meringue px-1.5 py-0.5">npm run seed</code>{" "}
                to import the three existing articles, or write a new one.
              </>
            )
          }
          action={
            !filtering && (
              <Link href="/admin/blog/new" className="admin-btn admin-btn-primary">
                Write a post
              </Link>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <div className="mt-6">
          {/* Cards below lg, table from lg up. A five-column table cannot be
              read on a phone; a card fits every field the table shows. */}
          <ul className="admin-rows grid gap-3 sm:grid-cols-2 lg:hidden">
            {rows.map((row) => (
              <RecordCard
                key={row.id}
                thumb={<Cover cover={row.cover} />}
                title={row.title.en}
                subtitle={`/${row.slug} · ${row.readingTime} min read`}
                badges={
                  <>
                    <StatusPill status={row.status} />
                    {row.category && (
                      <span className="rounded-full bg-meringue px-2.5 py-1 text-xs font-semibold capitalize text-russet-dark/70">
                        {row.category.replace("-", " ")}
                      </span>
                    )}
                    {row.publishAt && (
                      <span className="rounded-full bg-meringue px-2.5 py-1 text-xs font-semibold text-russet-dark/70">
                        {formatLongDate(row.publishAt)}
                      </span>
                    )}
                  </>
                }
                editHref={`/admin/blog/${row.id}`}
                onDelete={() => setPending(row)}
                label={row.title.en}
              />
            ))}
          </ul>

          <div className="admin-card hidden overflow-hidden lg:block">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-olive">
                <tr>
                  <th className="px-5 py-3 font-semibold">Post</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="admin-row border-t border-camel-light/25"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Cover cover={row.cover} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-russet">
                            {row.title.en}
                          </p>
                          <p className="truncate text-xs text-russet-dark/55">
                            /{row.slug} · {row.readingTime} min read
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 capitalize text-russet-dark/75">
                      {row.category?.replace("-", " ")}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-russet-dark/65">
                      {row.publishAt ? formatLongDate(row.publishAt) : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={row.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions
                        editHref={`/admin/blog/${row.id}`}
                        onDelete={() => setPending(row)}
                        label={row.title.en}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} />

      <ConfirmDialog
        open={Boolean(pending)}
        busy={deleting}
        title="Delete this post?"
        message={`“${pending?.title.en ?? ""}” will be removed from the Learn section. This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
