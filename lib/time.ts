/**
 * Dates, in the timezone the business actually lives in.
 *
 * THE BUG THIS EXISTS TO PREVENT. Vercel functions run in **UTC** — the
 * `regions: ["bom1"]` in vercel.json is geography, not a timezone, and nothing
 * sets `TZ`. IKSARVA runs in **IST, UTC+5:30**. So `new Date().getMonth()` on
 * the server answers a question nobody asked: which month is it in London?
 *
 * For the five and a half hours between 00:00 and 05:30 IST on the first of any
 * month, those two answers differ. An invoice raised at 05:00 IST on 1 October
 * is stored as `2026-09-30T23:30:00Z`, and every piece of code that read its
 * month got **September**:
 *
 *   - it filed in September's GSTR-1
 *   - it was numbered IA.09.26.NNN, appended to a series that had closed
 *   - at the 1 April boundary it would be stamped with the previous financial
 *     year
 *   - the date printed on the invoice, and on the CSV the CA files, was a day
 *     early
 *
 * On a farm business where the day starts before dawn, that window is not
 * hypothetical. Nothing in the database is wrong — `issuedAt` is a correct
 * instant, set from the server's own clock and never accepted from a client —
 * so this is a bucketing and formatting fault, not corrupted data.
 *
 * A FIXED OFFSET, NOT `Intl`. India has observed no daylight saving since 1945
 * and has a single timezone nationwide, so +5:30 is exact for every instant
 * this system will ever hold. That makes every function here pure integer
 * arithmetic — testable to the minute, with no dependency on the host's ICU
 * data, which is the same reasoning that made `groupIndian()` in lib/money.ts
 * hand-written rather than `toLocaleString`.
 */

/** +5:30. Asia/Kolkata, which has never observed DST. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60_000;

export const IST_LABEL = "IST";

/**
 * The same instant, shifted so the UTC accessors read as IST wall-clock time.
 *
 * Deliberately private and deliberately never handed out: the returned Date is
 * a LIE about when something happened, useful only for reading calendar fields
 * off. Letting one escape into a comparison or a database write is exactly how
 * a timezone fix becomes a timezone bug.
 */
function asIstClock(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Calendar year in India — 2026. */
export function istYear(date: Date): number {
  return asIstClock(date).getUTCFullYear();
}

/** Calendar month in India, 1–12. Not zero-indexed; that trap is not worth it. */
export function istMonth(date: Date): number {
  return asIstClock(date).getUTCMonth() + 1;
}

/** Day of the month in India, 1–31. */
export function istDay(date: Date): number {
  return asIstClock(date).getUTCDate();
}

/** Year, month and day together, when a caller needs more than one. */
export function istParts(date: Date): { year: number; month: number; day: number } {
  const clock = asIstClock(date);
  return {
    year: clock.getUTCFullYear(),
    month: clock.getUTCMonth() + 1,
    day: clock.getUTCDate(),
  };
}

/**
 * The instant midnight IST begins on the first of this month.
 *
 * The inverse of the accessors above, and the piece the reports need: a query
 * bound has to be a real instant, because that is what is stored. Midnight on
 * 1 October 2026 in India is 2026-09-30T18:30:00Z, and an invoice raised a
 * minute later must land inside October.
 */
export function istMonthStart(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS);
}

/**
 * The Indian financial year a date falls in — April to March, as "25-26".
 *
 * What the CA files by, so the April boundary has to be read in IST: an
 * invoice at 03:00 IST on 1 April 2026 belongs to 26-27, and in UTC it looks
 * like 31 March.
 */
export function istFinancialYear(date: Date): string {
  const { year, month } = istParts(date);
  const startYear = month >= 4 ? year : year - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}-${two(startYear + 1)}`;
}

/** dd-mm-yyyy, which is what the GST portal expects. */
export function formatIstDate(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "04 Sep 2026", for a printed document.
 *
 * Written out rather than `toLocaleDateString("en-IN")` for two reasons: that
 * formats in the host's zone, which is the whole bug; and its output depends on
 * the ICU data the runtime happens to ship, which is not a thing a tax invoice
 * should vary on.
 */
export function formatIstDateLong(date: Date): string {
  const { year, month, day } = istParts(date);
  return `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * "04 Sep 2026, 14:05", for a call log entry or an audit line.
 *
 * Client components render on the server first, so `toLocaleString("en-IN")`
 * in one paints the UTC clock into the HTML and the phone's clock after
 * hydration — a mismatch warning at best, and for the five and a half hours
 * after midnight a different DAY on first paint. Same fix as the dates above.
 */
export function formatIstDateTime(date: Date): string {
  const clock = asIstClock(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${formatIstDateLong(date)}, ${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`;
}

/* -------------------------------------------------------------------------- */
/* <input type="datetime-local">                                              */
/* -------------------------------------------------------------------------- */

/**
 * The pair below exist because a `datetime-local` input has NO timezone.
 *
 * It shows and returns a bare wall-clock string, and whoever reads it decides
 * what zone that was. Both ends here previously used the server's, so a post
 * scheduled for 09:00 was written as 09:00 UTC and published at 14:30 IST —
 * five and a half hours after the director meant. Consistent, and consistently
 * wrong.
 *
 * These two are exact inverses. Change one and you must change the other.
 */

/** "2026-09-04T09:00" — the IST wall clock, for the input's value. */
export function istDateTimeInputValue(date: Date): string {
  const clock = asIstClock(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${clock.getUTCFullYear()}-${pad(clock.getUTCMonth() + 1)}-${pad(clock.getUTCDate())}` +
    `T${pad(clock.getUTCHours())}:${pad(clock.getUTCMinutes())}`
  );
}

/**
 * Read that value back as a real instant, treating it as IST.
 *
 * A string that already carries a zone (a stored ISO timestamp, ending Z or
 * +05:30) is passed through untouched — only the bare form is ambiguous, and
 * only the bare form is ours to interpret.
 */
export function parseIstDateTimeInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const bare = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!bare) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, y, mo, d, h, mi, sec] = bare;
  const utc = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(sec ?? 0),
  );
  return new Date(utc - IST_OFFSET_MS);
}

/** Full month name, for a screen heading. */
export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
