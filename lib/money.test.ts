import { describe, expect, it } from "vitest";
import {
  amountInWords,
  formatINR,
  formatRupees,
  groupIndian,
  paiseToRupeeString,
  roundHalfAwayFromZero,
  rupeesToPaise,
} from "./money";

describe("rupeesToPaise", () => {
  it("reads plain rupees", () => {
    expect(rupeesToPaise("1234.56")).toBe(123456);
    expect(rupeesToPaise("1234")).toBe(123400);
    expect(rupeesToPaise(0)).toBe(0);
  });

  it("reads what people actually type", () => {
    expect(rupeesToPaise("₹1,234.50")).toBe(123450);
    expect(rupeesToPaise("  1234.5  ")).toBe(123450);
    expect(rupeesToPaise("1,94,844")).toBe(19484400);
  });

  it("returns null for anything unreadable, never 0", () => {
    // A blank field and a typo must not silently become "free".
    for (const bad of ["", "  ", "abc", "12.3.4", "-", ".", null, undefined]) {
      expect(rupeesToPaise(bad)).toBeNull();
    }
  });

  it("does not lose the value floats cannot hold", () => {
    // 12.35 is 12.3499999999999996 in binary floating point.
    expect(rupeesToPaise("12.35")).toBe(1235);
    expect(rupeesToPaise("0.07")).toBe(7);
    expect(rupeesToPaise("1.005")).toBe(101);
  });

  it("handles negatives, for credit notes", () => {
    expect(rupeesToPaise("-1234.56")).toBe(-123456);
  });
});

describe("roundHalfAwayFromZero", () => {
  it("rounds a half away from zero in both directions", () => {
    // Math.round(-0.5) is -0 — half UP, not half away. A credit note would
    // then not exactly cancel the invoice it reverses.
    expect(roundHalfAwayFromZero(0.5)).toBe(1);
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
  });

  it("is symmetric, so a reversal cancels exactly", () => {
    for (const v of [0.5, 1.5, 2.5, 12.345, -7.77, 1234.5]) {
      expect(roundHalfAwayFromZero(v) + roundHalfAwayFromZero(-v)).toBe(0);
    }
  });
});

describe("formatting", () => {
  it("groups digits the Indian way", () => {
    expect(groupIndian("1234567")).toBe("12,34,567");
    expect(groupIndian("100000")).toBe("1,00,000");
    expect(groupIndian("999")).toBe("999");
    expect(groupIndian("1000")).toBe("1,000");
    expect(groupIndian("10000000")).toBe("1,00,00,000");
  });

  it("prints an amount", () => {
    expect(formatINR(123456)).toBe("₹1,234.56");
    expect(formatINR(19484400)).toBe("₹1,94,844.00");
    expect(formatINR(7)).toBe("₹0.07");
    expect(formatINR(-123456)).toBe("-₹1,234.56");
  });

  it("prints rupees only where paise are noise", () => {
    expect(formatRupees(123456)).toBe("₹1,234");
    expect(formatRupees(99)).toBe("₹0");
  });

  it("prints a bare decimal for exports", () => {
    expect(paiseToRupeeString(123456)).toBe("1234.56");
    expect(paiseToRupeeString(7)).toBe("0.07");
    expect(paiseToRupeeString(100)).toBe("1.00");
  });
});

describe("amountInWords", () => {
  it("writes the small cases", () => {
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(100)).toBe("Rupees One Only");
    expect(amountInWords(1500)).toBe("Rupees Fifteen Only");
    expect(amountInWords(123456)).toBe(
      "Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only",
    );
  });

  it("uses the Indian system, not the western short scale", () => {
    expect(amountInWords(10_000_000 * 100)).toBe("Rupees One Crore Only");
    expect(amountInWords(100_000 * 100)).toBe("Rupees One Lakh Only");
    expect(amountInWords(12_345_678 * 100)).toBe(
      "Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Only",
    );
  });

  it("scales past a hundred crore by repeating the word", () => {
    expect(amountInWords(1_000_00_00_000 * 100)).toContain("Thousand Crore");
  });

  it("says the paise only when there are some", () => {
    expect(amountInWords(10000)).toBe("Rupees One Hundred Only");
    expect(amountInWords(10001)).toBe("Rupees One Hundred and One Paise Only");
  });

  it("handles a credit note", () => {
    expect(amountInWords(-123456)).toBe(
      "Minus Rupees One Thousand Two Hundred Thirty Four and Fifty Six Paise Only",
    );
  });

  it("covers the teens and the round tens", () => {
    expect(amountInWords(1900)).toBe("Rupees Nineteen Only");
    expect(amountInWords(2000)).toBe("Rupees Twenty Only");
    expect(amountInWords(9900)).toBe("Rupees Ninety Nine Only");
    expect(amountInWords(11100)).toBe("Rupees One Hundred Eleven Only");
  });

  it("agrees with the figure it came from, for every rupee up to a lakh", () => {
    // The invariant that matters on an invoice: the words and the number are
    // the same value. Spot-checked densely rather than argued about.
    for (let rupees = 0; rupees <= 100_000; rupees += 997) {
      const words = amountInWords(rupees * 100);
      expect(words.startsWith("Rupees ")).toBe(true);
      expect(words.endsWith(" Only")).toBe(true);
      expect(words).not.toContain("undefined");
      expect(words).not.toMatch(/\s{2}/);
    }
  });
});
