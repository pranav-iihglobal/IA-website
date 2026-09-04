import { istParts, MONTH_LABELS } from "@/lib/time";
import type { GstReturn, HsnRow } from "./gst";

/**
 * A GST period as it appears in a URL — `2026-09` — and the small facts the
 * summary page states about one. Pure, so the two pages, the picker and the
 * API read the same string the same way.
 */

export interface Period {
  year: number;
  month: number;
}

/** "2026-09" → { 2026, 9 }; anything else → null. */
export function parsePeriod(value: string | undefined | null): Period | null {
  const match = /^(\d{4})-(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function formatPeriod({ year, month }: Period): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** "September 2026" */
export function periodLabel({ year, month }: Period): string {
  return `${MONTH_LABELS[month - 1]} ${year}`;
}

/** The month India is in right now. */
export function currentPeriod(now = new Date()): Period {
  const { year, month } = istParts(now);
  return { year, month };
}

/** The month before, across a year boundary. */
export function previousPeriod({ year, month }: Period): Period {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export type GstSection = "b2b" | "b2cs" | "cdnr" | "cdnur" | "hsn";

export interface SectionCount {
  key: GstSection;
  label: string;
  /** One line on what the section is, for the card. */
  hint: string;
  rows: number;
}

/** How many rows each GSTR-1 section has this period, in filing order. */
export function sectionCounts(built: GstReturn, hsn: HsnRow[]): SectionCount[] {
  return [
    { key: "b2b", label: "B2B", hint: "sales to buyers with a GSTIN, one row per invoice and rate", rows: built.b2b.length },
    { key: "b2cs", label: "B2CS", hint: "sales to unregistered buyers, summarised per state and rate", rows: built.b2cs.length },
    { key: "cdnr", label: "CDNR", hint: "credit notes to registered buyers", rows: built.cdnr.length },
    { key: "cdnur", label: "CDNUR", hint: "credit notes to unregistered buyers", rows: built.cdnur.length },
    { key: "hsn", label: "HSN", hint: "Table 12 — every supply by HSN code and rate", rows: hsn.length },
  ];
}

/** "3 KB" for a CSV about to be downloaded; bytes below a kilobyte say so. */
export function csvSize(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
