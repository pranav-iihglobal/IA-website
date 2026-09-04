import type { HistoryEntry } from "@/lib/admin/history";
import { documentKind } from "@/lib/erp/document-kind";
import type { ProfileInvoice } from "./profile";

/**
 * The story of one customer, in order.
 *
 * The profile showed the call log, the change history and the invoices as
 * three separate sections — three lists to read side by side to work out
 * what happened in July. Merged into one dated stream they read as the
 * relationship: sampled in May, called twice, bought in June, a credit note
 * in July, a payment chased in August.
 *
 * Pure: takes the three lists the page already loads, returns one. Newest
 * first, like every other history in this panel. Nothing here is stored.
 */

export interface NoteLike {
  _id?: string;
  body: string;
  author?: string;
  at?: string | Date;
}

export type TimelineEntry =
  | { kind: "note"; id: string; at: string; body: string; author: string }
  | { kind: "change"; id: string; at: string; entry: HistoryEntry }
  | { kind: "invoice" | "credit_note" | "sample_note"; id: string; at: string; invoice: ProfileInvoice };

/** Where a document sorts against another at the same instant: later kinds win the tie. */
const TIE_ORDER: Record<TimelineEntry["kind"], number> = {
  invoice: 0,
  note: 1,
  change: 2,
  // A credit note raised the same second as its invoice is the LATER event.
  credit_note: 3,
  sample_note: 0,
};

function iso(value: string | Date | undefined | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function mergeTimeline({
  notes,
  history,
  invoices,
}: {
  notes: NoteLike[];
  history: HistoryEntry[];
  /** Pass [] when the viewer may not see money — the entries are then simply absent. */
  invoices: ProfileInvoice[];
}): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  notes.forEach((n, i) => {
    entries.push({
      kind: "note",
      id: `note:${n._id ?? i}`,
      at: iso(n.at),
      body: n.body,
      author: n.author ?? "",
    });
  });

  for (const h of history) {
    /*
      A logged call is written to the audit log as well (action "note"), so
      it would appear twice — once as what was said, once as "a note was
      added". The note itself is the record; the audit line is dropped.
    */
    if (h.action === "note") continue;
    entries.push({ kind: "change", id: `change:${h.id}`, at: h.at, entry: h });
  }

  for (const inv of invoices) {
    entries.push({
      kind: documentKind(inv),
      id: `inv:${inv.id}`,
      at: iso(inv.issuedAt),
      invoice: inv,
    });
  }

  // Newest first. Undated entries (a note with no timestamp) sink to the end.
  return entries.sort((a, b) => {
    if (a.at !== b.at) {
      if (!a.at) return 1;
      if (!b.at) return -1;
      return b.at.localeCompare(a.at);
    }
    return TIE_ORDER[b.kind] - TIE_ORDER[a.kind];
  });
}
