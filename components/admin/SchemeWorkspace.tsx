"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import { EmptyState, ErrorBanner, ListCard, StatusPill } from "./ui";
import { adminFetch } from "@/lib/admin/fetch";
import { describeSchemeDiscount } from "@/lib/erp/schemes";
import { formatIstDateTime } from "@/lib/time";
import type { SchemeList, SchemeRow } from "@/lib/erp/scheme-store";

/**
 * Every scheme, live ones first.
 *
 * Small enough to be one server-rendered list with no search and no paging —
 * a business runs a handful of offers a year — so the only client work is
 * the delete confirmation and the refresh after it.
 */

const CHANNEL_LABEL: Record<string, string> = {
  both: "everyone",
  b2c: "farmers",
  b2b: "dealers",
};

const STATUS_LABEL: Record<SchemeRow["status"], string> = {
  active: "active",
  upcoming: "upcoming",
  expired: "expired",
  off: "off",
};

export function SchemeWorkspace({
  initial,
  canWrite,
  canDelete,
}: {
  initial: SchemeList;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState<SchemeRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await adminFetch<{ ok: boolean }>(`/api/admin/schemes/${deleting.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!result.ok) {
      // Stays open with the reason, so the row being deleted is not lost.
      setError(result.error ?? "Could not delete");
      return;
    }
    toast(`${deleting.name} deleted`);
    setDeleting(null);
    router.refresh();
  }

  const live = initial.items.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Schemes
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {live} live
            </span>
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            Seasonal discounts that apply themselves between two dates. A typed discount always wins.
          </p>
        </div>
        {canWrite && (
          <Link href="/admin/schemes/new" className="admin-btn admin-btn-primary admin-tap">
            Add scheme
          </Link>
        )}
      </div>

      <ErrorBanner message={error} />

      {initial.items.length === 0 ? (
        <EmptyState
          title="No schemes"
          message="A Kharif offer, a Diwali dealer discount — set it once with its dates and every invoice in the window gets it."
          action={
            canWrite ? (
              <Link href="/admin/schemes/new" className="admin-btn admin-btn-primary admin-tap">
                Add scheme
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {initial.items.map((row) => (
            <ListCard
              key={row.id}
              title={
                canWrite ? (
                  <Link href={`/admin/schemes/${row.id}/edit`} className="hover:text-cta hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )
              }
              subtitle={`${formatIstDateTime(new Date(row.startAt))} → ${formatIstDateTime(new Date(row.endAt))}`}
              figure={describeSchemeDiscount(row)}
              figureNote={`for ${CHANNEL_LABEL[row.channel] ?? row.channel}`}
              pills={
                <>
                  <StatusPill status={STATUS_LABEL[row.status]} />
                  <span className="text-ink-faint">
                    {row.productNames.length === 0 ? "every product" : row.productNames.join(", ")}
                  </span>
                </>
              }
              meta={row.notes || undefined}
              actions={
                canWrite ? (
                  <>
                    <Link href={`/admin/schemes/${row.id}/edit`} className="admin-btn admin-btn-ghost admin-tap">
                      Edit
                    </Link>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setDeleting(row);
                        }}
                        className="admin-btn admin-btn-ghost admin-tap text-danger"
                      >
                        Delete
                      </button>
                    )}
                  </>
                ) : undefined
              }
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "this scheme"}?`}
        message="A scheme that has already been applied on an invoice cannot be deleted — switch it off instead. One that never was is simply removed."
        confirmLabel={busy ? "Deleting…" : "Delete"}
        cancelLabel="Keep it"
        onConfirm={() => void remove()}
        onCancel={() => {
          if (!busy) setDeleting(null);
        }}
      />
    </div>
  );
}
