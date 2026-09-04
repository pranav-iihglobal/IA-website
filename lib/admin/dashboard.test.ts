import { describe, expect, it } from "vitest";
import { change, greeting, productComparison, recentMonths } from "./dashboard";
import { istDay, istHour, istMonth } from "@/lib/time";

/**
 * The dashboard's pure parts. The queries need a cluster; the windows, the
 * comparison line and the greeting do not, and the windows are where the
 * Phase 0 bug would come back.
 */

describe("recentMonths", () => {
  it("ends with the current month in IST and runs back six", () => {
    // 05:00 IST on 1 October is still 30 September in UTC.
    const now = new Date("2026-09-30T23:30:00.000Z");
    const months = recentMonths(now, 6);
    expect(months.map((m) => m.short)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    expect(months[5].label).toBe("October");
    expect(months[5].year).toBe(2026);
    expect(recentMonths(now, 12)).toHaveLength(12);
    expect(recentMonths(now, 12)[0].label).toBe("November");
  });

  it("crosses a year boundary", () => {
    const months = recentMonths(new Date("2026-02-15T10:00:00.000Z"), 6);
    expect(months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2025-9", "2025-10", "2025-11", "2025-12", "2026-1", "2026-2",
    ]);
  });

  it("gives each month IST bounds that meet exactly", () => {
    const months = recentMonths(new Date("2026-09-03T06:00:00.000Z"), 3);
    for (let i = 1; i < months.length; i++) {
      expect(months[i].from.getTime()).toBe(months[i - 1].to.getTime());
    }
    expect(istDay(months[0].from)).toBe(1);
    expect(istHour(months[0].from)).toBe(0);
    expect(istMonth(months[2].from)).toBe(9);
  });
});

describe("change", () => {
  it("names the month it compares against", () => {
    expect(change(124_000, 100_000, "August")).toBe("up 24% on August");
    expect(change(92_000, 100_000, "August")).toBe("down 8% on August");
    expect(change(100_000, 100_000, "August")).toBe("level with August");
  });

  it("says nothing when there is nothing to compare", () => {
    expect(change(0, 0, "August")).toBeNull();
    expect(change(5_000, 0, "August")).toBe("first sales since August");
  });
});

describe("greeting", () => {
  it("follows the clock in India, first name only", () => {
    // 02:30 UTC is 08:00 IST; 09:00 UTC is 14:30; 13:00 UTC is 18:30.
    expect(greeting(new Date("2026-09-03T02:30:00.000Z"), "Pranav Patel")).toBe("Good morning, Pranav");
    expect(greeting(new Date("2026-09-03T09:00:00.000Z"), "Dipen")).toBe("Good afternoon, Dipen");
    expect(greeting(new Date("2026-09-03T13:00:00.000Z"), "")).toBe("Good evening");
  });
});

describe("productComparison", () => {
  const row = (name: string, thisPaise: number, lastPaise = 0) => ({ name, thisPaise, lastPaise });

  it("puts the biggest seller this month first", () => {
    const out = productComparison([row("NPK", 100), row("FloraMax", 300), row("Myco", 200)]);
    expect(out.map((r) => r.name)).toEqual(["FloraMax", "Myco", "NPK"]);
  });

  it("keeps a product that sold last month but not this", () => {
    expect(productComparison([row("Old", 0, 500)])).toEqual([row("Old", 0, 500)]);
  });

  it("drops a product that sold in neither month", () => {
    expect(productComparison([row("Nothing", 0, 0), row("A", 1)])).toEqual([row("A", 1)]);
  });

  it("folds everything past the top into Other, summing both months", () => {
    const out = productComparison(
      [row("A", 9), row("B", 8), row("C", 7, 1), row("D", 6, 2), row("E", 5, 3)],
      3,
    );
    expect(out.map((r) => r.name)).toEqual(["A", "B", "C", "Other"]);
    expect(out[3]).toEqual({ name: "Other", thisPaise: 11, lastPaise: 5 });
  });

  it("does not add an Other row when everything fits", () => {
    expect(productComparison([row("A", 1), row("B", 2)], 6).map((r) => r.name)).toEqual(["B", "A"]);
  });
});
