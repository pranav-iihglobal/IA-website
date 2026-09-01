import { nextInSeries, raiseSeriesTo } from "@/lib/db/models/Counter";

/**
 * Invoice numbering — `IA.MM.YY.NNN`, exactly as IKSARVA already issues them.
 *
 * Their existing format, kept rather than improved on: 53 of these are printed
 * on documents, filed with the GST department and known to their customers. A
 * "better" scheme would orphan every one of them.
 *
 * The sequence RESETS EACH MONTH — IA.07.26.004 is the fourth invoice of July
 * 2026, not the fourth ever — so the counter is per month, not global.
 *
 * The financial year is tracked alongside because it is what the CA files by,
 * and it does not follow the calendar: April to March, so January 2026 is in
 * 25-26, not 26-27.
 */

/** The Indian financial year runs 1 April → 31 March. */
export function financialYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: 3 is April
  const startYear = month >= 3 ? year : year - 1;
  const two = (y: number) => String(y % 100).padStart(2, "0");
  return `${two(startYear)}-${two(startYear + 1)}`;
}

/** The counter key for one month. One series per month, because it resets. */
export function seriesKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `invoice:${yy}:${mm}`;
}

/** Render a number in their format. `IA.09.26.007`. */
export function formatInvoiceNumber(date: Date, sequence: number): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `IA.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

/**
 * Read a number back. Returns null for anything that is not one of ours.
 *
 * The import needs this to seed the counters from what has already been
 * issued: it cannot ask the app what the last number was, only the documents.
 */
export function parseInvoiceNumber(
  value: string,
): { month: number; year: number; sequence: number } | null {
  const match = /^IA\.(\d{2})\.(\d{2})\.(\d{3,})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return { month, year: 2000 + Number(match[2]), sequence: Number(match[3]) };
}

/**
 * Allocate the next invoice number for a date. Atomic; never repeats.
 *
 * The number is taken at the moment the invoice is ISSUED, never when a draft
 * is started — otherwise an abandoned draft leaves a hole in the series, and
 * a gap in a GST invoice sequence is something the department asks about.
 */
export async function allocateInvoiceNumber(
  issuedAt: Date = new Date(),
): Promise<{ number: string; sequence: number; financialYear: string }> {
  const sequence = await nextInSeries(seriesKey(issuedAt));
  return {
    number: formatInvoiceNumber(issuedAt, sequence),
    sequence,
    financialYear: financialYear(issuedAt),
  };
}

/**
 * Seed a month's counter from an already-issued number, during the import.
 *
 * Only ever raises — see raiseSeriesTo. Re-running the import cannot move a
 * counter back onto numbers that have already been used.
 */
export async function seedFromIssuedNumber(value: string): Promise<boolean> {
  const parsed = parseInvoiceNumber(value);
  if (!parsed) return false;
  const date = new Date(parsed.year, parsed.month - 1, 1);
  await raiseSeriesTo(seriesKey(date), parsed.sequence);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Sample invoices                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Seeded invoices get their OWN series, and it is visible in the number.
 *
 * They cannot share the real counter. Wiping sample data would then leave
 * permanent holes in an issued GST sequence — and a missing number is
 * something the department asks about, which is the whole reason the counter
 * is atomic in the first place.
 *
 * The `SMP` prefix is deliberate rather than cosmetic: a number that looked
 * real would eventually be read out to somebody as if it were.
 */
export function sampleSeriesKey(date: Date): string {
  return `sample-${seriesKey(date)}`;
}

export function formatSampleInvoiceNumber(date: Date, sequence: number): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  return `SMP.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

/** True for a number this app issued as sample data. */
export function isSampleInvoiceNumber(value: string): boolean {
  return /^SMP\./.test(value.trim());
}
