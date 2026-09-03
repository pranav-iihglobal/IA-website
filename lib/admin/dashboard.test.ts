import { describe, expect, it } from "vitest";
import { change, greeting, recentMonths } from "./dashboard";
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
