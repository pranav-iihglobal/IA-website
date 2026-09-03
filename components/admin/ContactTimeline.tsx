"use client";

import Link from "next/link";
import { StatusPill } from "./ui";
import { HistoryItem } from "./RecordHistory";
import { formatINR } from "@/lib/money";
import { formatIstDateLong, formatIstDateTime } from "@/lib/time";
import type { TimelineEntry } from "@/lib/crm/timeline";

/**
 * One customer's story, rendered — see lib/crm/timeline.ts.
 *
 * Each kind keeps the rendering it had in its own section: a call is its
 * text and who logged it, a change is HistoryItem with every field from → to,
 * an invoice is its number, amount and standing, linked to the record.
 */
export function ContactTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="mt-3 text-sm text-ink-muted">Nothing has happened yet.</p>;
  }
  return (
    <ol className="mt-3 divide-y divide-line-soft">
      {entries.map((e) => {
        if (e.kind === "change") return <HistoryItem key={e.id} entry={e.entry} />;
        if (e.kind === "note") {
          return (
            <li key={e.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <StatusPill status="note" />
                <span className="text-sm font-semibold text-ink-strong">{e.author || "—"}</span>
                {e.at && (
                  <time dateTime={e.at} className="text-xs text-ink-faint">
                    {formatIstDateTime(new Date(e.at))}
                  </time>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{e.body}</p>
            </li>
          );
        }
        const inv = e.invoice;
        const cancelled = inv.status === "cancelled";
        return (
          <li key={e.id} className="flex flex-wrap items-baseline gap-2 py-3">
            <StatusPill status={cancelled ? "cancelled" : e.kind === "credit_note" ? "credit note" : inv.paymentStatus} />
            <Link
              /* The record, not the printable document. What is still owed is
                 a question about its history, and the paperwork cannot answer it. */
              href={`/admin/invoices/${inv.id}`}
              className="min-w-0 truncate text-sm font-semibold text-ink-strong hover:text-cta hover:underline"
            >
              {inv.number || "(no number)"}
              {e.kind === "credit_note" && inv.againstNumber && (
                <span className="ml-1 text-xs font-normal text-ink-faint">credits {inv.againstNumber}</span>
              )}
            </Link>
            {inv.issuedAt && (
              <time dateTime={inv.issuedAt} className="text-xs text-ink-faint">
                {formatIstDateLong(new Date(inv.issuedAt))}
              </time>
            )}
            {/* Negative for a credit note, as in the internal ledger: the minus
                is what makes the rows add up to the totals above them. */}
            <span className={`ml-auto shrink-0 text-sm tabular-nums ${cancelled ? "text-ink-faint line-through" : "text-ink-strong"}`}>
              {formatINR(inv.grandTotalPaise)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
