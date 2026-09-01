"use client";

import { useRouter } from "next/navigation";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Which month is being filed.
 *
 * Navigates rather than holding state, so the period is in the URL — a GST
 * period is the kind of thing that gets sent to an accountant as a link, and
 * a back button should return to the month you were looking at.
 */
export function MonthPicker({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  const go = (y: number, m: number) => router.push(`/admin/gst?year=${y}&month=${m}`);

  return (
    <div className="flex items-center gap-2">
      <select
        value={month}
        onChange={(e) => go(year, Number(e.target.value))}
        aria-label="Month"
        className="admin-input w-auto"
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => go(Number(e.target.value), month)}
        aria-label="Year"
        className="admin-input w-auto"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
