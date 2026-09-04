/**
 * How overdue a debt is.
 *
 * The outstanding screen listed unpaid invoices oldest first and said how many
 * days old each one was. That is the right ordering — the four-month-old
 * invoice is the one that needs the call — but it could not answer the two
 * questions that follow: how much of what we are owed is genuinely stuck, and
 * which customers is it stuck with.
 *
 * The buckets are the ones a collections conversation actually uses. 30 days
 * is the usual credit period here, so "current" means not yet a problem;
 * past 90 is where a debt stops being late and starts being doubtful.
 *
 * Pure, so the bands can be checked without a database — the same reason
 * buildFilter() and summariseTrading() are.
 */

export type AgeBucket = "current" | "d31_60" | "d61_90" | "d90_plus";

export const AGE_BUCKETS: { key: AgeBucket; label: string; hint: string }[] = [
  { key: "current", label: "Not yet due", hint: "0–30 days" },
  { key: "d31_60", label: "31–60 days", hint: "past the usual terms" },
  { key: "d61_90", label: "61–90 days", hint: "chase it" },
  { key: "d90_plus", label: "Over 90 days", hint: "doubtful" },
];

/**
 * Which band an invoice falls in.
 *
 * The boundaries are INCLUSIVE at the top of each band: day 30 is still
 * current, day 31 is not. An invoice raised today is 0 days old, and a
 * negative age — a clock skew, a back-dated import — is treated as current
 * rather than thrown away, because a debt that is not yet due is exactly what
 * "current" means.
 */
export function ageBucket(daysOld: number): AgeBucket {
  if (daysOld <= 30) return "current";
  if (daysOld <= 60) return "d31_60";
  if (daysOld <= 90) return "d61_90";
  return "d90_plus";
}

export interface AgeingTotals {
  current: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
}

export const NO_AGEING: AgeingTotals = {
  current: 0,
  d31_60: 0,
  d61_90: 0,
  d90_plus: 0,
};

/** Total owed per band. Amounts in paise, like everything else. */
export function summariseAgeing(
  rows: { daysOld: number; owedPaise: number }[],
): AgeingTotals {
  const totals = { ...NO_AGEING };
  for (const row of rows) totals[ageBucket(row.daysOld)] += row.owedPaise;
  return totals;
}

/**
 * What one customer owes, rolled up from their unpaid invoices.
 *
 * Grouping by the CONTACT rather than by the name on the document: two
 * invoices to the same farmer are one phone call, and the party name is a
 * snapshot that may read differently on two invoices a year apart.
 */
export interface PartyDebt {
  contactId: string | null;
  name: string;
  phone: string;
  invoices: number;
  owedPaise: number;
  /** What those invoices came to, and what has already come back. */
  invoicedPaise: number;
  paidPaise: number;
  creditedPaise: number;
  /** The oldest unpaid invoice's age, which is what decides urgency. */
  oldestDays: number;
}

export function groupByParty(
  rows: {
    contactId: string | null;
    partyName: string;
    partyPhone: string;
    owedPaise: number;
    daysOld: number;
    grandTotalPaise?: number;
    paidPaise?: number;
    creditedPaise?: number;
  }[],
): PartyDebt[] {
  const parties = new Map<string, PartyDebt>();

  for (const row of rows) {
    /*
      An invoice with no contactId is one raised before the link existed, or
      against a record since deleted. Those are keyed by NAME so they still
      roll up sensibly, rather than each becoming its own group.
    */
    const key = row.contactId ?? `name:${row.partyName}`;
    const existing = parties.get(key);
    if (existing) {
      existing.invoices += 1;
      existing.owedPaise += row.owedPaise;
      existing.invoicedPaise += row.grandTotalPaise ?? 0;
      existing.paidPaise += row.paidPaise ?? 0;
      existing.creditedPaise += row.creditedPaise ?? 0;
      existing.oldestDays = Math.max(existing.oldestDays, row.daysOld);
      // Keep the first number that is actually usable.
      if (!existing.phone && row.partyPhone) existing.phone = row.partyPhone;
    } else {
      parties.set(key, {
        contactId: row.contactId,
        name: row.partyName,
        phone: row.partyPhone,
        invoices: 1,
        owedPaise: row.owedPaise,
        invoicedPaise: row.grandTotalPaise ?? 0,
        paidPaise: row.paidPaise ?? 0,
        creditedPaise: row.creditedPaise ?? 0,
        oldestDays: row.daysOld,
      });
    }
  }

  // Most owed first: this list answers "where is the money", and the
  // invoice list beside it already answers "who has waited longest".
  return [...parties.values()].sort((a, b) => b.owedPaise - a.owedPaise);
}

/**
 * Each band's share of the whole, as whole percentages that ADD UP TO 100.
 *
 * Plain rounding of four shares lands on 99 or 101 often enough to be
 * noticed on a bar that is supposed to be the whole debt. Largest remainder:
 * floor each share, then hand the leftover points to the bands that lost the
 * most in flooring. Everything zero gives four zeros, not a division error.
 */
export function ageingShares(totals: AgeingTotals): { key: AgeBucket; share: number }[] {
  const keys = AGE_BUCKETS.map((b) => b.key);
  const whole = keys.reduce((sum, key) => sum + Math.max(0, totals[key]), 0);
  if (whole <= 0) return keys.map((key) => ({ key, share: 0 }));

  const exact = keys.map((key) => (Math.max(0, totals[key]) * 100) / whole);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = keys
    .map((_, i) => i)
    .sort((a, b) => exact[b] - floors[b] - (exact[a] - floors[a]) || a - b);
  for (const i of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return keys.map((key, i) => ({ key, share: floors[i] }));
}

/**
 * How a debtor's row should read, from how long their oldest bill has waited.
 * Past 60 days is red — the same threshold the bands use for "chase it";
 * past 30 is the usual credit period and is flagged without alarm.
 */
export function partyTone(oldestDays: number): "danger" | "warn" | undefined {
  if (oldestDays > 60) return "danger";
  if (oldestDays > 30) return "warn";
  return undefined;
}
