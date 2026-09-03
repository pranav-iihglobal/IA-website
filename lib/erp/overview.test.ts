import { describe, expect, it } from "vitest";
import { salesWindows } from "./overview";
import { istMonth, istYear } from "@/lib/time";

/** 05:00 IST on 1 October 2026 — 23:30Z on 30 September. The Phase 0 instant. */
const EARLY_FIRST = new Date("2026-09-30T23:30:00.000Z");

describe("salesWindows", () => {
  it("reads the month in IST, not UTC", () => {
    const w = salesWindows(EARLY_FIRST);
    expect(w.thisMonth.label).toBe("October 2026");
    expect(w.lastMonth.label).toBe("September 2026");
    expect(w.sameMonthLastYear.label).toBe("October 2025");
    expect(istMonth(w.thisMonth.from)).toBe(10);
  });

  it("rolls January back to December of the previous year", () => {
    const w = salesWindows(new Date("2027-01-15T06:00:00.000Z"));
    expect(w.lastMonth.label).toBe("December 2026");
    expect(istYear(w.lastMonth.from)).toBe(2026);
  });

  it("starts the financial year in April and runs it to the end of this month", () => {
    const w = salesWindows(new Date("2027-02-10T06:00:00.000Z"));
    expect(w.fy.label).toBe("FY 26-27");
    expect(istMonth(w.fy.from)).toBe(4);
    expect(istYear(w.fy.from)).toBe(2026);
    expect(w.fy.to.getTime()).toBe(w.thisMonth.to.getTime());
  });

  it("puts 1 April at 03:00 IST in the NEW financial year", () => {
    // 21:30Z on 31 March is 03:00 on 1 April in India.
    const w = salesWindows(new Date("2027-03-31T21:30:00.000Z"));
    expect(w.fy.label).toBe("FY 27-28");
    expect(w.thisMonth.label).toBe("April 2027");
  });
});
