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
  RowActions,
  SearchInput,
  StatusPill,
  TableSkeleton,
} from "./ui";

interface Row {
  id: string;
  farmerName: { en: string; gu?: string };
  village: string;
  district: string;
  crop: { en: string; gu?: string };
  status: string;
  featured: boolean;
  photo: string | null;
  videoPlatform: string;
  verified: boolean;
  verifiedVia: string;
  source: string;
  updatedAt: string;
  updatedBy: string;
}

const VERIFIED_LABEL: Record<string, string> = {
  whatsapp: "Verified on WhatsApp",
  field_visit: "Verified by field visit",
  photo: "Verified by photo",
};

/** "Last edited" line: date plus who saved it, when known. */
function lastEdited(row: Row): string {
  const when = formatShortDate(row.updatedAt);
  if (!when) return "";
  return row.updatedBy ? `${when} · ${row.updatedBy}` : when;
}

/** Small badge showing whether the story carries a video or is text only. */
function MediaBadge({ platform }: { platform: string }) {
  if (!platform) {
    return <span className="text-xs text-russet-dark/55">Text only</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-meringue px-2.5 py-1 text-[11px] font-semibold capitalize text-russet-dark/80">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
        <path d="M3 6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm11.5 2.3 2.6-1.7a.6.6 0 0 1 .9.5v5.8a.6.6 0 0 1-.9.5l-2.6-1.7V8.3Z" />
      </svg>
      {platform}
    </span>
  );
}

export function TestimonialList() {
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
      }>(`/api/admin/testimonials?${params}`);
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
    const result = await adminFetch(`/api/admin/testimonials/${pending.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (!result.ok) {
      toast(result.error ?? "Could not delete the testimonial", "error");
      setPending(null);
      return;
    }
    toast(`Testimonial from “${pending.farmerName.en}” deleted`);
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
          placeholder="Search farmer, village or district…"
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
        <span className="text-sm text-russet-dark/55">
          {loading ? "Loading…" : `${total} testimonial${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <ErrorBanner message={error} />

      {loading && rows.length === 0 && <TableSkeleton />}

      {!loading && rows.length === 0 && !error && (
        <EmptyState
          title={filtering ? "No matching testimonials" : "No testimonials yet"}
          message={
            filtering
              ? "Try a different search term or clear the status filter."
              : "Add a farmer story — name, village, crop and what changed in their field."
          }
          action={
            !filtering && (
              <Link
                href="/admin/testimonials/new"
                className="admin-btn admin-btn-primary"
              >
                Add a testimonial
              </Link>
            )
          }
        />
      )}

      {rows.length > 0 && (
        <div className="admin-card mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-olive">
                <tr>
                  <th className="px-5 py-3 font-semibold">Farmer</th>
                  <th className="px-5 py-3 font-semibold">Crop</th>
                  <th className="px-5 py-3 font-semibold">Media</th>
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-laurel-light/40 ring-1 ring-camel-light/50">
                          {row.photo ? (
                            <Image
                              src={cldUrl(row.photo, CLD.thumb) ?? row.photo}
                              alt=""
                              width={40}
                              height={40}
                              unoptimized
                              className="h-10 w-10 object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-olive-dark">
                              {row.farmerName.en.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-semibold text-russet">
                            <span className="truncate">{row.farmerName.en}</span>
                            {row.verified && (
                              <span
                                title={
                                  VERIFIED_LABEL[row.verifiedVia] ?? "Verified"
                                }
                                className="shrink-0 text-olive"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </span>
                            )}
                            {row.source === "whatsapp_submission" && (
                              <span
                                title="Sent by the farmer on WhatsApp"
                                className="shrink-0 rounded-full bg-laurel-light/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-olive-dark"
                              >
                                WA
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-russet-dark/55">
                            {[row.village, row.district].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-russet-dark/75">
                      {row.crop?.en}
                    </td>
                    <td className="px-5 py-3.5">
                      <MediaBadge platform={row.videoPlatform} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusPill status={row.status} />
                      {lastEdited(row) && (
                        <p
                          className="mt-1 truncate text-[11px] text-russet-dark/50"
                          title={`Last edited ${lastEdited(row)}`}
                        >
                          {lastEdited(row)}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <RowActions
                        editHref={`/admin/testimonials/${row.id}`}
                        onDelete={() => setPending(row)}
                        label={row.farmerName.en}
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
        title="Delete this testimonial?"
        message={`The story from “${pending?.farmerName.en ?? ""}” will be removed from the website. This cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
