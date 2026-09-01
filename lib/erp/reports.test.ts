import { describe, expect, it } from "vitest";
import { monthRange } from "./reports";
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
