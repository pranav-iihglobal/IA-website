import { nextInSeries, raiseSeriesTo } from "@/lib/db/models/Counter";
import { istFinancialYear, istMonthStart, istParts } from "@/lib/time";

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
 *
 * EVERY DATE HERE IS READ IN IST, never in the server's UTC. The month segment
 * of a number is part of a filed GST series, so an invoice raised at 05:00 IST
 * on the 1st must not be stamped with last month — see lib/time.ts.
 */

/** `mm` and `yy` for a number, as the calendar reads in India. */
function stamp(date: Date): { mm: string; yy: string } {
  const { year, month } = istParts(date);
  return {
    mm: String(month).padStart(2, "0"),
    yy: String(year % 100).padStart(2, "0"),
  };
}

/** The Indian financial year runs 1 April → 31 March. */
export function financialYear(date: Date): string {
  return istFinancialYear(date);
}

/** The counter key for one month. One series per month, because it resets. */
export function seriesKey(date: Date): string {
  const { mm, yy } = stamp(date);
  return `invoice:${yy}:${mm}`;
}

/** Render a number in their format. `IA.09.26.007`. */
export function formatInvoiceNumber(date: Date, sequence: number): string {
  const { mm, yy } = stamp(date);
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
  /*
    Built as an IST instant, not `new Date(y, m, 1)`. That happened to give the
    right key only because the server runs UTC and the shift to IST is forward;
    on any other host it would have keyed the wrong month. The number already
    says which month it belongs to — the round trip should not be able to lose
    that.
  */
  const date = istMonthStart(parsed.year, parsed.month);
  await raiseSeriesTo(seriesKey(date), parsed.sequence);
  return true;
}

/* -------------------------------------------------------------------------- */
/* Sample invoices                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Seeded invoices get their OWN series, and it is visible in the number.
 *
 * DEMO, not SMP: the SMP prefix now belongs to a REAL series — sample notes,
 * the free samples given to a prospect at sample stage (see Phase 13.8).
 * Seeded data is demo data, and its number says so.
 *
 * They cannot share the real counter. Wiping sample data would then leave
 * permanent holes in an issued GST sequence — and a missing number is
 * something the department asks about, which is the whole reason the counter
 * is atomic in the first place.
 *
 * The `DEMO` prefix is deliberate rather than cosmetic: a number that looked
 * real would eventually be read out to somebody as if it were.
 */
export function demoSeriesKey(date: Date): string {
  return `demo-${seriesKey(date)}`;
}

export function formatDemoInvoiceNumber(date: Date, sequence: number): string {
  const { mm, yy } = stamp(date);
  return `DEMO.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

/**
 * A demo credit note: DEMO.CN.MM.YY.NNN.
 *
 * Still starts DEMO., so `isDemoInvoiceNumber` catches it and it can never be
 * mistaken for a real document — and the CN in the middle says which kind it
 * is at a glance.
 */
export function formatDemoCreditNoteNumber(date: Date, sequence: number): string {
  const { mm, yy } = stamp(date);
  return `DEMO.CN.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

/** True for a number this app issued as sample data. */
export function isDemoInvoiceNumber(value: string): boolean {
  return /^DEMO\./.test(value.trim());
}

/* -------------------------------------------------------------------------- */
/* Sample notes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Sample notes get their OWN series — SMP.MM.YY.NNN.
 *
 * A free sample handed to a prospect is not a supply for consideration, so
 * it is not a tax invoice and must not consume an IA number; it still moves
 * stock and is still a document somebody may ask about, so it is numbered.
 * The counter key is `smp:YY:MM` — deliberately NOT under `sample-` or
 * `demo-`, which `erp-sample -- wipe` deletes as seeded data. This series is
 * real.
 */
export function sampleNoteSeriesKey(date: Date): string {
  const { mm, yy } = stamp(date);
  return `smp:${yy}:${mm}`;
}

export function formatSampleNoteNumber(date: Date, sequence: number): string {
  const { mm, yy } = stamp(date);
  return `SMP.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

/** True for a sample note this app issued. Not a demo number, not a tax invoice. */
export function isSampleNoteNumber(value: string): boolean {
  return /^SMP\.\d{2}\.\d{2}\.\d{3,}$/.test(value.trim());
}

export async function allocateSampleNoteNumber(
  issuedAt: Date = new Date(),
): Promise<{ number: string; sequence: number; financialYear: string }> {
  const sequence = await nextInSeries(sampleNoteSeriesKey(issuedAt));
  return {
    number: formatSampleNoteNumber(issuedAt, sequence),
    sequence,
    financialYear: financialYear(issuedAt),
  };
}

/* -------------------------------------------------------------------------- */
/* Credit notes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Credit notes get their OWN series — CN.MM.YY.NNN.
 *
 * Not a preference: GST requires a credit note to carry its own consecutive
 * serial number, distinct from the invoice series. Sharing one would also mean
 * a credit note consuming an invoice number, leaving the invoice sequence with
 * a hole in it.
 */
export function creditNoteSeriesKey(date: Date): string {
  return `credit-${seriesKey(date)}`;
}

export function formatCreditNoteNumber(date: Date, sequence: number): string {
  const { mm, yy } = stamp(date);
  return `CN.${mm}.${yy}.${String(sequence).padStart(3, "0")}`;
}

export async function allocateCreditNoteNumber(
  issuedAt: Date = new Date(),
): Promise<{ number: string; sequence: number; financialYear: string }> {
  const sequence = await nextInSeries(creditNoteSeriesKey(issuedAt));
  return {
    number: formatCreditNoteNumber(issuedAt, sequence),
    sequence,
    financialYear: financialYear(issuedAt),
  };
}
