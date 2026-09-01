import { describe, expect, it } from "vitest";
import { describeMargin, marginPaise, marginPercent } from "./margin";

const rupees = (n: number) => n * 100;

describe("marginPaise", () => {
  it("is what is left after cost", () => {
    expect(marginPaise(rupees(250), rupees(130))).toBe(rupees(120));
  });

  it("goes negative when a pack sells below cost", () => {
    expect(marginPaise(rupees(100), rupees(130))).toBe(rupees(-30));
  });

  it("is null when either side is unknown", () => {
    // Not zero: an unpriced pack and a zero-margin pack are different facts.
    expect(marginPaise(rupees(250), undefined)).toBeNull();
    expect(marginPaise(undefined, rupees(130))).toBeNull();
    expect(marginPaise(null, null)).toBeNull();
  });
});

describe("marginPercent", () => {
  it("is margin on the SELLING price, not markup on cost", () => {
    // Bought at ₹50, sold at ₹100: 50% margin, 100% markup. Not the same.
    expect(marginPercent(rupees(100), rupees(50))).toBe(50);
  });

  it("rounds to one decimal place", () => {
    expect(marginPercent(rupees(300), rupees(199))).toBe(33.7);
  });

  it("is null rather than Infinity at a selling price of zero", () => {
    expect(marginPercent(0, rupees(50))).toBeNull();
  });

  it("reports a loss as a negative percentage", () => {
    expect(marginPercent(rupees(100), rupees(150))).toBe(-50);
  });
});

describe("describeMargin", () => {
  it("reads as one line", () => {
    expect(describeMargin(rupees(250), rupees(130))).toBe("₹120 · 48%");
  });

  it("shows a loss with a real minus sign", () => {
    expect(describeMargin(rupees(100), rupees(130))).toBe("−₹30 · −30%");
  });

  it("says nothing when there is nothing to say", () => {
    expect(describeMargin(rupees(250), undefined)).toBeNull();
  });

  it("gives the money even when the percentage is undefined", () => {
    expect(describeMargin(0, 0)).toBe("₹0");
  });
});
