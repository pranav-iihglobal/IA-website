import { describe, expect, it } from "vitest";
import { monthRange } from "./reports";

/**
 * Only the pure part. Everything else here is a database query, covered by
 * running the screens against seeded data.
 */
describe("monthRange", () => {
  it("starts at the first instant of the month", () => {
    const { from } = monthRange(2026, 9);
    expect(from.getFullYear()).toBe(2026);
    expect(from.getMonth()).toBe(8);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
  });

  it("ends EXCLUSIVELY at the next month, not on the last day", () => {
    // An invoice raised at 23:59 on the 30th belongs to that month. An
    // inclusive end on the 30th at 00:00 would drop it from the return.
    const { to } = monthRange(2026, 9);
    expect(to.getMonth()).toBe(9);
    expect(to.getDate()).toBe(1);
  });

  it("rolls December into the next January", () => {
    const { from, to } = monthRange(2026, 12);
    expect(from.getMonth()).toBe(11);
    expect(to.getFullYear()).toBe(2027);
    expect(to.getMonth()).toBe(0);
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
