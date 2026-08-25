"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CLD, cldUrl } from "@/lib/images";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  EmptyState,
  ErrorBanner,
  FilterTabs,
  Pagination,
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
      const response = await fetch(`/api/admin/posts?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load");
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
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
    const response = await fetch(`/api/admin/posts/${pending.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      toast(data.error ?? "Could not delete the post", "error");
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
        <div className="admin-card mt-6 overflow-hidden">
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
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-meringue-light ring-1 ring-camel-light/50">
                          {row.cover ? (
                            <Image
                              src={cldUrl(row.cover, CLD.thumb) ?? row.cover}
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
                      {row.publishAt
                        ? new Date(row.publishAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
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
