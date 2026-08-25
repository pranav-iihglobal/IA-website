"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CLD, cldUrl } from "@/lib/images";
import { Button, StatusPill } from "./ui";

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
}

export function TestimonialList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const response = await fetch(`/api/admin/testimonials?${params}`);
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

  async function remove(row: Row) {
    if (!window.confirm(`Delete the testimonial from “${row.farmerName.en}”?`)) return;
    const response = await fetch(`/api/admin/testimonials/${row.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Could not delete");
      return;
    }
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search farmer, village or district…"
          className="w-72 rounded-lg border border-camel-light bg-white px-3 py-2 text-sm outline-none focus:border-olive focus:ring-2 focus:ring-olive/25"
        />
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-lg border border-camel-light bg-white px-3 py-2 text-sm outline-none focus:border-olive"
        >
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <span className="text-sm text-russet-dark/60">
          {loading ? "Loading…" : `${total} testimonial${total === 1 ? "" : "s"}`}
        </span>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-alloy/40 bg-alloy/10 px-4 py-3 text-sm text-russet">
          {error}
        </p>
      )}

      {!loading && rows.length === 0 && !error && (
        <p className="mt-8 text-sm text-russet-dark/70">
          No testimonials yet. Add one, or run{" "}
          <code className="rounded bg-cornsilk px-1">npm run seed</code> to import
          the samples as drafts.
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-cornsilk-dark bg-cornsilk text-xs uppercase tracking-wide text-olive">
              <tr>
                <th className="px-4 py-3">Farmer</th>
                <th className="px-4 py-3">Crop</th>
                <th className="px-4 py-3">Media</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-cornsilk-dark last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-meringue-light">
                        {row.photo && (
                          <Image
                            src={cldUrl(row.photo, CLD.thumb) ?? row.photo}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="h-10 w-10 object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-russet">
                          {row.farmerName.en}
                        </p>
                        <p className="text-xs text-russet-dark/60">
                          {[row.village, row.district].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-russet-dark/80">{row.crop?.en}</td>
                  <td className="px-4 py-3 text-xs capitalize text-russet-dark/70">
                    {row.videoPlatform || "text"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/testimonials/${row.id}`}
                        className="rounded-full border border-olive px-4 py-1.5 text-xs font-semibold text-olive-dark hover:bg-laurel-light/40"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        className="rounded-full border border-russet-light px-4 py-1.5 text-xs font-semibold text-russet hover:bg-russet-light/10"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Previous
          </Button>
          <span className="text-sm text-russet-dark/70">
            Page {page} of {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
