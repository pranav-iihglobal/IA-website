/**
 * Money, as whole paise.
 *
 * Every rupee amount in this app is an INTEGER NUMBER OF PAISE. Never a float,
 * never a string, never rupees. `12.35` is not representable in binary floating
 * point — it is 12.3499999999999996447... — so a spreadsheet column of rupees
 * drifts, and a grand total stops agreeing with the sum of its own lines. Their
 * workbook holds rupees as floats, which is exactly how that happens.
 *
 * Integers do not drift. 1235 paise is 1235 paise after any amount of addition.
 * The only place precision is ever lost is where a rate is applied, and that is
 * one function, rounded once, tested.
 *
 * Rupees exist here at exactly two boundaries: reading what a person typed
 * (`rupeesToPaise`) and showing them a number (`formatINR`, `amountInWords`).
 * Nothing in between.
 *
 * Safe range: a JS integer is exact to 2^53, which is ₹90,07,19,92,54,740 —
 * about ninety thousand crore. Not a constraint here.
 */

/** Paise in a rupee. Named so the arithmetic below reads as intent. */
const PAISE_PER_RUPEE = 100;

/**
 * Parse what a person typed into paise.
 *
 * Accepts what people actually write: `1,234.5`, `₹1234.50`, ` 1234 `, `-50`.
 * Returns null for anything it cannot read, rather than NaN or 0 — a blank
 * field and a typo must not silently become "free".
 *
 * More than two decimal places is a typo, not a precision we support: there is
 * no such thing as a third of a paisa on a tax invoice. It is rounded, half
 * away from zero, the same way the rest of this module rounds.
 */
export function rupeesToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined || input === "") return null;

  const text = String(input).trim().replace(/[₹,\s]/g, "");
  if (!/^-?\d*\.?\d*$/.test(text) || text === "" || text === "." || text === "-") {
    return null;
  }

  const rupees = Number(text);
  if (!Number.isFinite(rupees)) return null;

  return roundHalfAwayFromZero(rupees * PAISE_PER_RUPEE);
}

/**
 * Round half away from zero — 0.5 up, -0.5 down.
 *
 * NOT `Math.round`, which rounds -0.5 to -0 (half UP, towards positive
 * infinity). That asymmetry means a credit note for the same amount as an
 * invoice would not cancel it exactly, which is a real defect in a system that
 * issues both.
 *
 * The epsilon nudge is for the one case this module cannot avoid: a product of
 * two floats landing at 1234.4999999999998 when the exact answer is 1234.5.
 * Without it that rounds down and a line is a paisa short.
 */
export function roundHalfAwayFromZero(value: number): number {
  const sign = value < 0 ? -1 : 1;
  return sign * Math.round(Math.abs(value) + Number.EPSILON * Math.abs(value));
}

/** Paise as a plain decimal string — "123456" → "1234.56". No symbol, no grouping. */
export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;
  return `${sign}${rupees}.${String(remainder).padStart(2, "0")}`;
}

/**
 * Group digits the Indian way: 12,34,567 — not 1,234,567.
 *
 * Written out rather than left to `toLocaleString("en-IN")` because this number
 * goes on a tax invoice. Node's ICU data can be trimmed down in a deployment
 * (`--with-intl=small-icu`), and when it is, en-IN silently falls back to
 * western grouping. A printed invoice is not the place to find that out.
 */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  return `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`;
}

/** For display: `formatINR(123456)` → "₹1,234.56". */
export function formatINR(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;
  return `${sign}₹${groupIndian(String(rupees))}.${String(remainder).padStart(2, "0")}`;
}

/** Rupees only, for lists and totals where paise are noise: "₹1,234". */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const rupees = Math.floor(Math.abs(Math.trunc(paise)) / PAISE_PER_RUPEE);
  return `${sign}₹${groupIndian(String(rupees))}`;
}

/* -------------------------------------------------------------------------- */
/* Amount in words                                                            */
/* -------------------------------------------------------------------------- */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

/** 0–99. Returns "" for zero, so callers can skip empty groups. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const ones = ONES[n % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** 0–999. */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/**
 * A whole number in the Indian system: crore, lakh, thousand, hundred.
 *
 * Not the western short scale. "One Crore Twenty Three Lakh" is what a GST
 * invoice in India says, and it is what the CA expects to read.
 */
function wholeNumberInWords(n: number): string {
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  // Crores are not capped at 99 — beyond that the same word repeats, which is
  // how the Indian system actually scales ("one thousand crore").
  if (crore) parts.push(`${wholeNumberInWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/**
 * The figure in words, as it is printed on the invoice.
 *
 * Required on a tax invoice, and it must equal the grand total exactly. It is
 * derived from the same integer the total is, never typed and never rounded
 * separately, so the two cannot disagree — which is the specific failure this
 * whole module exists to prevent.
 */
export function amountInWords(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;

  /*
    Currency word FIRST — "Rupees One Thousand ... Only" — which is both the
    conventional Indian invoice phrasing and the one that sidesteps having to
    decide between "One Rupee" and "One Rupees".
  */
  const parts = [`Rupees ${wholeNumberInWords(rupees)}`];
  if (remainder) parts.push(`and ${twoDigits(remainder)} Paise`);

  return `${negative ? "Minus " : ""}${parts.join(" ")} Only`;
}
