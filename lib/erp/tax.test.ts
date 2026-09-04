import { describe, expect, it } from "vitest";
import { amountInWords, rupeesToPaise } from "@/lib/money";
import {
  clampDiscount,
  computeInvoice,
  formatRate,
  resolveDiscount,
  GUJARAT_STATE_CODE,
  supplyTypeFor,
  type InvoiceLineInput,
} from "./tax";

/** Their real SKUs and the 5% rate the directors confirmed. */
const floraMax = (quantity: number, rupees: string): InvoiceLineInput => ({
  description: "FloraMax 25 ml",
  hsn: "31010099",
  quantity,
  unitPricePaise: rupeesToPaise(rupees)!,
  gstRateBps: 500,
});

const at18 = (quantity: number, rupees: string): InvoiceLineInput => ({
  description: "Service",
  hsn: "9986",
  quantity,
  unitPricePaise: rupeesToPaise(rupees)!,
  gstRateBps: 1800,
});

describe("intra-state (Gujarat to Gujarat)", () => {
  it("splits the tax into CGST and SGST, never IGST", () => {
    const inv = computeInvoice([floraMax(10, "100")], "intra");
    expect(inv.subtotalPaise).toBe(100000);
    expect(inv.cgstPaise).toBe(2500);
    expect(inv.sgstPaise).toBe(2500);
    expect(inv.igstPaise).toBe(0);
    expect(inv.totalTaxPaise).toBe(5000);
  });

  it("keeps the two halves adding back to the tax when it is odd", () => {
    // 5% of ₹1.50 is 7.5 paise → 8 paise, which cannot halve evenly.
    const inv = computeInvoice([floraMax(1, "1.50")], "intra");
    expect(inv.cgstPaise + inv.sgstPaise).toBe(inv.totalTaxPaise);
    expect(Math.abs(inv.cgstPaise - inv.sgstPaise)).toBeLessThanOrEqual(1);
  });
});

describe("inter-state", () => {
  it("charges IGST and nothing else", () => {
    const inv = computeInvoice([floraMax(10, "100")], "inter");
    expect(inv.igstPaise).toBe(5000);
    expect(inv.cgstPaise).toBe(0);
    expect(inv.sgstPaise).toBe(0);
  });

  it("collects the same total tax as the intra-state equivalent", () => {
    const lines = [floraMax(7, "249.50"), at18(3, "99.99")];
    expect(computeInvoice(lines, "inter").totalTaxPaise).toBe(
      computeInvoice(lines, "intra").totalTaxPaise,
    );
  });

  it("is chosen by state code, not by pin", () => {
    expect(supplyTypeFor(GUJARAT_STATE_CODE, "24")).toBe("intra");
    expect(supplyTypeFor(GUJARAT_STATE_CODE, "27")).toBe("inter");
  });
});

describe("multi-line invoices mixing rates", () => {
  const lines = [floraMax(12, "245"), at18(2, "1500"), floraMax(1, "99.50")];

  it("summarises rate by rate", () => {
    const inv = computeInvoice(lines, "intra");
    expect(inv.byRate.map((r) => r.gstRateBps)).toEqual([500, 1800]);

    const five = inv.byRate[0];
    expect(five.taxableValuePaise).toBe(294000 + 9950);
    expect(five.cgstPaise + five.sgstPaise).toBe(
      inv.lines[0].cgstPaise +
        inv.lines[0].sgstPaise +
        inv.lines[2].cgstPaise +
        inv.lines[2].sgstPaise,
    );
  });

  it("has a rate summary that ties to the invoice totals", () => {
    // The specific discrepancy a filing gets queried on.
    const inv = computeInvoice(lines, "intra");
    const sum = (pick: (r: (typeof inv.byRate)[number]) => number) =>
      inv.byRate.reduce((t, r) => t + pick(r), 0);
    expect(sum((r) => r.taxableValuePaise)).toBe(inv.subtotalPaise);
    expect(sum((r) => r.cgstPaise)).toBe(inv.cgstPaise);
    expect(sum((r) => r.sgstPaise)).toBe(inv.sgstPaise);
    expect(sum((r) => r.igstPaise)).toBe(inv.igstPaise);
  });

  it("subtracts a discount before tax", () => {
    const inv = computeInvoice(
      [{ ...floraMax(10, "100"), discountPaise: 10000 }],
      "intra",
    );
    expect(inv.subtotalPaise).toBe(90000);
    expect(inv.totalTaxPaise).toBe(4500);
  });
});

describe("rounding", () => {
  it("settles on a whole rupee and shows the difference as its own line", () => {
    const inv = computeInvoice([floraMax(1, "99.50")], "intra");
    expect(inv.grandTotalPaise % 100).toBe(0);
    expect(inv.roundOffPaise).toBe(inv.grandTotalPaise - inv.grossPaise);
    expect(Math.abs(inv.roundOffPaise)).toBeLessThan(100);
  });

  it("reports no round-off when the total is already whole", () => {
    const inv = computeInvoice([floraMax(10, "100")], "intra");
    expect(inv.roundOffPaise).toBe(0);
    expect(inv.grandTotalPaise).toBe(105000);
  });
});

describe("the invariants that make an invoice legible", () => {
  /* Deliberately awkward numbers: odd paise, mixed rates, discounts. */
  const cases: [string, InvoiceLineInput[]][] = [
    ["one line", [floraMax(1, "0.01")]],
    ["ten of an odd price", [floraMax(10, "33.33")]],
    ["mixed rates", [floraMax(3, "249.50"), at18(1, "1999.99")]],
    ["with a discount", [{ ...at18(4, "777.77"), discountPaise: 12345 }]],
    ["their real order size", [floraMax(24, "245"), floraMax(12, "99.50")]],
    ["a big one", [at18(1000, "1234.56")]],
    ["free of charge", [floraMax(1, "0")]],
  ];

  it.each(cases)("%s: the lines add up to the total", (_label, lines) => {
    for (const supply of ["intra", "inter"] as const) {
      const inv = computeInvoice(lines, supply);
      const lineSum = inv.lines.reduce((t, l) => t + l.lineTotalPaise, 0);
      expect(lineSum).toBe(inv.grossPaise);
      expect(inv.grossPaise + inv.roundOffPaise).toBe(inv.grandTotalPaise);
    }
  });

  it.each(cases)("%s: only one kind of tax is charged", (_label, lines) => {
    const intra = computeInvoice(lines, "intra");
    expect(intra.igstPaise).toBe(0);
    const inter = computeInvoice(lines, "inter");
    expect(inter.cgstPaise + inter.sgstPaise).toBe(0);
  });

  it.each(cases)("%s: the words say the same number as the total", (_l, lines) => {
    const inv = computeInvoice(lines, "intra");
    expect(inv.amountInWords).toBe(amountInWords(inv.grandTotalPaise));
    expect(inv.amountInWords).not.toContain("Paise"); // always whole rupees
  });

  it.each(cases)("%s: every amount is a whole number of paise", (_l, lines) => {
    const inv = computeInvoice(lines, "intra");
    for (const value of [
      inv.subtotalPaise, inv.cgstPaise, inv.sgstPaise, inv.igstPaise,
      inv.grossPaise, inv.roundOffPaise, inv.grandTotalPaise,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe("credit notes", () => {
  const reverse = (lines: InvoiceLineInput[]) =>
    computeInvoice(lines.map((l) => ({ ...l, quantity: -l.quantity })), "intra");

  it("reverses an invoice to exactly zero", () => {
    const lines = [floraMax(7, "249.50"), at18(3, "99.99")];
    expect(
      computeInvoice(lines, "intra").grandTotalPaise + reverse(lines).grandTotalPaise,
    ).toBe(0);
    expect(
      computeInvoice(lines, "intra").totalTaxPaise + reverse(lines).totalTaxPaise,
    ).toBe(0);
  });

  it("reverses exactly even when the total lands on half a rupee", () => {
    /*
      The case that justifies rounding half AWAY from zero. ₹10 at 5% is
      ₹10.50 gross — exactly a half. Math.round would send the invoice to ₹11
      and the credit note to ₹-10, leaving a rupee behind that belongs to
      nobody. This is the whole reason lib/money.ts does not use Math.round.
    */
    const lines = [floraMax(1, "10")];
    const invoice = computeInvoice(lines, "intra");
    expect(invoice.grossPaise).toBe(1050);
    expect(invoice.grandTotalPaise).toBe(1100);
    expect(reverse(lines).grandTotalPaise).toBe(-1100);
    expect(invoice.grandTotalPaise + reverse(lines).grandTotalPaise).toBe(0);
  });
});

describe("formatRate", () => {
  it("prints whole and half percentages", () => {
    expect(formatRate(500)).toBe("5%");
    expect(formatRate(1800)).toBe("18%");
    expect(formatRate(250)).toBe("2.5%");
    expect(formatRate(1250)).toBe("12.5%");
  });
});

describe("discounts", () => {
  it("resolves a percentage to paise, in basis points, rounded once", () => {
    // 10% of ₹2,450.00
    expect(resolveDiscount(245000, "percent", 1000)).toBe(24500);
    // 12.5% of ₹33.33 = ₹4.16625 → ₹4.17
    expect(resolveDiscount(3333, "percent", 1250)).toBe(417);
    expect(resolveDiscount(3333, "flat", 500)).toBe(500);
  });

  it("clamps a discount to the line, so nothing goes negative", () => {
    expect(clampDiscount(245000, 500000)).toBe(245000);
    expect(clampDiscount(245000, -100)).toBe(0);
    expect(clampDiscount(245000, 12345)).toBe(12345);
    // Mirrored on a credit-note line.
    expect(clampDiscount(-245000, -500000)).toBe(-245000);
    expect(clampDiscount(-245000, 100)).toBe(0);
  });

  it("makes a line free at most, never negative, inside computeInvoice", () => {
    const inv = computeInvoice([{ ...floraMax(10, "245"), discountPaise: 9_999_999 }], "intra");
    expect(inv.lines[0].taxableValuePaise).toBe(0);
    expect(inv.totalTaxPaise).toBe(0);
    expect(inv.grandTotalPaise).toBe(0);
  });
});
