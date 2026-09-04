import { describe, expect, it } from "vitest";
import { monthRange, outstandingPipeline, owedOnInvoice } from "./reports";
import { istDay, istMonth, istYear } from "@/lib/time";

/**
 * Only the pure part. Everything else here is a database query, covered by
 * running the screens against seeded data.
 *
 * ASSERTED IN IST, not with `getMonth()`. These tests used to read the bounds
 * with the local accessors, which passed only because the assertion carried the
 * same UTC assumption as the code — so they agreed with each other and both
 * disagreed with Gujarat. A month here is a month as the business reckons it.
 */
describe("monthRange", () => {
  it("starts at the first instant of the month in IST", () => {
    const { from } = monthRange(2026, 9);
    expect(istYear(from)).toBe(2026);
    expect(istMonth(from)).toBe(9);
    expect(istDay(from)).toBe(1);
    // Midnight in India, which is half past six the previous evening in UTC.
    expect(from.toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });

  it("ends EXCLUSIVELY at the next month, not on the last day", () => {
    // An invoice raised at 23:59 on the 30th belongs to that month. An
    // inclusive end on the 30th at 00:00 would drop it from the return.
    const { to } = monthRange(2026, 9);
    expect(istMonth(to)).toBe(10);
    expect(istDay(to)).toBe(1);
  });

  it("keeps an invoice raised at 05:00 IST on the 1st in the right month", () => {
    /*
      The bug this file now guards. Stored as 2026-09-30T23:30Z, so with UTC
      bounds it fell below the start of October and filed in September.
    */
    const earlyOnTheFirst = new Date("2026-09-30T23:30:00.000Z");
    const october = monthRange(2026, 10);
    const september = monthRange(2026, 9);
    expect(earlyOnTheFirst >= october.from && earlyOnTheFirst < october.to).toBe(true);
    expect(earlyOnTheFirst >= september.from && earlyOnTheFirst < september.to).toBe(false);
  });

  it("rolls December into the next January", () => {
    const { from, to } = monthRange(2026, 12);
    expect(istMonth(from)).toBe(12);
    expect(istYear(to)).toBe(2027);
    expect(istMonth(to)).toBe(1);
  });

  it("covers February without dropping a day", () => {
    const { from, to } = monthRange(2027, 2);
    const days = Math.round((+to - +from) / 86_400_000);
    expect(days).toBe(28);
  });

  it("covers a leap February", () => {
    const { from, to } = monthRange(2028, 2);
    expect(Math.round((+to - +from) / 86_400_000)).toBe(29);
  });
});

/**
 * The owed arithmetic, and the shape of the pipeline that mirrors it.
 *
 * The outstanding list, its total, the per-customer page and the dashboard
 * all used to compute owed as grandTotal − paid and never subtracted the
 * credit notes raised against the invoice, so a part-credited invoice was
 * chased for its full value while its own detail page showed the truth.
 */
describe("owedOnInvoice", () => {
  it("subtracts what was paid AND what was credited", () => {
    expect(owedOnInvoice(1_000_000, 300_000, 400_000)).toBe(300_000);
  });

  it("drops to zero, never negative, once credits cover the balance", () => {
    expect(owedOnInvoice(1_000_000, 0, 1_000_000)).toBe(0);
    expect(owedOnInvoice(1_000_000, 700_000, 400_000)).toBe(0);
    // A rounding overpayment is not a debt either.
    expect(owedOnInvoice(1_000_000, 1_000_012, 0)).toBe(0);
  });
});

describe("outstandingPipeline", () => {
  const stages = outstandingPipeline({ contactId: "x" });
  const find = (key: string) => stages.filter((s) => key in s);

  it("keeps the caller's filter and never admits a paid invoice, a credit note or a sample note", () => {
    const [{ $match }] = find("$match") as { $match: Record<string, unknown> }[];
    expect($match).toMatchObject({
      contactId: "x",
      status: "issued",
      documentType: { $nin: ["credit_note", "sample_note"] },
      "payment.status": { $ne: "paid" },
    });
  });

  it("joins only ISSUED credit notes, by the invoice they are against", () => {
    const [{ $lookup }] = find("$lookup") as { $lookup: Record<string, unknown> }[];
    const inner = ($lookup.pipeline as { $match?: Record<string, unknown> }[])[0].$match!;
    expect(inner).toMatchObject({ documentType: "credit_note", status: "issued" });
    expect(JSON.stringify(inner.$expr)).toContain("$againstInvoiceId");
    // Same collection: the self-join must name the model's collection, not a
    // string that drifts when the model is renamed.
    expect(typeof $lookup.from).toBe("string");
    expect($lookup.from).toBe("invoices");
  });

  it("filters on the computed owed AFTER the join, so a fully credited invoice drops off", () => {
    const matches = find("$match") as { $match: Record<string, unknown> }[];
    const last = matches[matches.length - 1].$match;
    expect(last).toEqual({ owedPaise: { $gt: 0 } });
    expect(stages.indexOf(matches[matches.length - 1])).toBeGreaterThan(
      stages.indexOf(find("$lookup")[0]),
    );
  });
});
