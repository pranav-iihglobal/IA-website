import { nextInSeries, raiseSeriesTo } from "@/lib/db/models/Counter";

/**
 * Contact ids — IKS-C-034, IKS-B-001, IKS-L-012 — allocated, not typed.
 *
 * They are printed on paperwork and known to the team, which is exactly why
 * they were typed by hand: the record had to carry the id already on the
 * document. But a hand-typed id has no guard against being typed twice, and
 * two leads called IKS-L-012 is a question nobody can answer from the paper.
 *
 * So the number comes from the same atomic Counter that numbers invoices
 * (lib/db/models/Counter.ts): one series per kind of contact, `$inc` inside
 * the server, and two directors saving a lead in the same second get two
 * different ids. A typed id is still accepted — the 5,118 real contacts carry
 * ids from paper, and the import must keep them — and the import seeds each
 * series past the highest id it finds, with `$max`, the way the invoice
 * import seeds its series. Nothing here ever restarts at 001.
 *
 * Only the pure half lives in tests; allocation needs a cluster and is
 * covered by scripts/check-erp.ts.
 */

/** The prefix a real id carries. Sample data uses SMP, see sampleContactSeries. */
export const CONTACT_ID_PREFIX = "IKS";

/** C for a customer, B for a dealer, L for a lead. D is the leads database. */
export type ContactSeriesLetter = "C" | "B" | "L";

/**
 * Which series a contact numbers in.
 *
 * A dealer is a customer on the b2b channel, and the sheets give dealers
 * their own B series — so the letter depends on both fields, not on kind
 * alone.
 */
export function contactSeriesLetter(kind: string, channel: string): ContactSeriesLetter {
  if (kind !== "customer") return "L";
  return channel === "b2b" ? "B" : "C";
}

/**
 * The Counter key for a real series: "contact:C".
 *
 * Sample contacts never touch a counter — the seed numbers them by index
 * under the SMP prefix, so a wipe has nothing to reset and a real series can
 * never be moved by seeding.
 */
export function contactSeriesKey(letter: ContactSeriesLetter): string {
  return `contact:${letter}`;
}

/**
 * IKS-C-034. Three digits, and more once a series passes 999 — a padded
 * width is a reading aid, not a ceiling.
 */
export function formatContactId(
  letter: ContactSeriesLetter,
  sequence: number,
  prefix: string = CONTACT_ID_PREFIX,
): string {
  return `${prefix}-${letter}-${String(sequence).padStart(3, "0")}`;
}

export interface ParsedContactId {
  prefix: string;
  letter: string;
  sequence: number;
}

/**
 * Read an id back, or null for anything that is not one of ours.
 *
 * Deliberately loose about the prefix and the letter: the real data holds
 * IKS-D-2403 from the leads database, and the import rule is report, never
 * guess. Only the SHAPE is fixed — letters, a dash, a letter, a dash, digits.
 */
export function parseContactId(value: string): ParsedContactId | null {
  const match = /^([A-Z]{2,4})-([A-Z])-(\d{1,9})$/.exec(value.trim().toUpperCase());
  if (!match) return null;
  return { prefix: match[1], letter: match[2], sequence: Number(match[3]) };
}

/** True when this id belongs to a real series this module allocates from. */
export function isAllocatedSeries(parsed: ParsedContactId): parsed is ParsedContactId & {
  letter: ContactSeriesLetter;
} {
  return parsed.prefix === CONTACT_ID_PREFIX && /^[CBL]$/.test(parsed.letter);
}

/**
 * Whether changing kind or channel moves a contact to a different series —
 * the moment a converted lead is given its customer id.
 */
export function seriesChanges(
  before: { kind: string; channel: string },
  after: { kind: string; channel: string },
): boolean {
  return (
    contactSeriesLetter(before.kind, before.channel) !==
    contactSeriesLetter(after.kind, after.channel)
  );
}

/** Take the next id in the real series for this kind of contact. */
export async function allocateContactId(kind: string, channel: string): Promise<string> {
  const letter = contactSeriesLetter(kind, channel);
  const sequence = await nextInSeries(contactSeriesKey(letter));
  return formatContactId(letter, sequence);
}

/**
 * Seed a series from an id that already exists — the real import, and the
 * doctor's repair of a series that has fallen behind hand-typed ids.
 *
 * `$max`, so a re-run can never drag a series backwards onto ids already
 * given out. Ids from other prefixes or letters (IKS-D-2403, a typo) are
 * ignored and reported by the caller; they seed nothing.
 */
export async function seedFromContactId(value: string): Promise<boolean> {
  const parsed = parseContactId(value);
  if (!parsed || !isAllocatedSeries(parsed)) return false;
  await raiseSeriesTo(contactSeriesKey(parsed.letter), parsed.sequence);
  return true;
}
