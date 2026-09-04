import { formatIstDateLong, istParts } from "@/lib/time";
import type { HistoryEntry } from "./history";

/**
 * The activity feed's pure parts: which day an entry belongs to (in India),
 * what to call that day, whose initial to draw, and what the date presets
 * mean. Tested without a database, like every other lib here.
 */

export interface DayGroup {
  /** "2026-09-04", the IST day. */
  key: string;
  /** "Today", "Yesterday", or the long date. */
  label: string;
  entries: HistoryEntry[];
}

/** yyyy-mm-dd for an instant, as the calendar reads in India. */
export function istDayKey(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Newest day first, entries kept in the order given (newest first). */
export function groupByIstDay(entries: HistoryEntry[], now = new Date()): DayGroup[] {
  const today = istDayKey(now);
  const yesterday = istDayKey(new Date(now.getTime() - 86_400_000));
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const at = entry.at ? new Date(entry.at) : null;
    const key = at && !Number.isNaN(at.getTime()) ? istDayKey(at) : "undated";
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      continue;
    }
    groups.push({
      key,
      label:
        key === "undated"
          ? "Undated"
          : key === today
            ? "Today"
            : key === yesterday
              ? "Yesterday"
              : formatIstDateLong(at as Date),
      entries: [entry],
    });
  }
  return groups;
}

/** One letter for the avatar disc — a name's first letter, or the email's. */
export function actorInitial(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

export type WhenPreset = "today" | "7d" | "30d";

export const WHEN_PRESETS: { key: WhenPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
];

/**
 * The date-input strings a preset stands for, in IST — "today" is the
 * Indian today, whatever the server's clock says. The end is today, and the
 * filter parser makes an end inclusive of its day.
 */
export function presetRange(preset: WhenPreset, now = new Date()): { from: string; to: string } {
  const to = istDayKey(now);
  const back = preset === "today" ? 0 : preset === "7d" ? 6 : 29;
  const from = istDayKey(new Date(now.getTime() - back * 86_400_000));
  return { from, to };
}

/** Which preset a from/to pair is, or null when it is a hand-typed range. */
export function activePreset(from: string, to: string, now = new Date()): WhenPreset | null {
  for (const { key } of WHEN_PRESETS) {
    const range = presetRange(key, now);
    if (range.from === from && range.to === to) return key;
  }
  return null;
}
