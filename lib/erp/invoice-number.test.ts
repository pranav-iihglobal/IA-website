import { describe, expect, it } from "vitest";
import {
  creditNoteSeriesKey,
  financialYear,
  formatCreditNoteNumber,
  formatInvoiceNumber,
  formatSampleCreditNoteNumber,
  isSampleInvoiceNumber,
  parseInvoiceNumber,
  seriesKey,
} from "./invoice-number";

/*
  The pure half of invoice numbering. Allocation itself is atomic inside
  MongoDB and cannot be proved without a cluster — scripts/check-erp.ts does
  that against a real connection.
*/

describe("financialYear", () => {
  it("starts in April, not January", () => {
    expect(financialYear(new Date(2025, 3, 1))).toBe("25-26"); // 1 Apr 2025
    expect(financialYear(new Date(2026, 2, 31))).toBe("25-26"); // 31 Mar 2026
    expect(financialYear(new Date(2026, 3, 1))).toBe("26-27"); // 1 Apr 2026
  });

  it("puts January in the year that began the previous April", () => {
    // The mistake that would file three months of invoices under the wrong year.
    expect(financialYear(new Date(2026, 0, 15))).toBe("25-26");
  });

  it("matches the year their sheets already use", () => {
    expect(financialYear(new Date(2025, 5, 12))).toBe("25-26"); // Jun 2025
    expect(financialYear(new Date(2026, 6, 3))).toBe("26-27"); // Jul 2026
  });
});

describe("formatInvoiceNumber", () => {
  it("writes their format", () => {
    expect(formatInvoiceNumber(new Date(2026, 8, 1), 7)).toBe("IA.09.26.007");
    expect(formatInvoiceNumber(new Date(2025, 5, 30), 1)).toBe("IA.06.25.001");
  });

  it("pads to three digits but does not truncate beyond them", () => {
    expect(formatInvoiceNumber(new Date(2026, 0, 1), 999)).toBe("IA.01.26.999");
    expect(formatInvoiceNumber(new Date(2026, 0, 1), 1000)).toBe("IA.01.26.1000");
  });
});

describe("seriesKey", () => {
  it("gives each month its own counter, because the sequence resets", () => {
    expect(seriesKey(new Date(2026, 8, 1))).toBe("invoice:26:09");
    expect(seriesKey(new Date(2026, 9, 1))).toBe("invoice:26:10");
    expect(seriesKey(new Date(2026, 8, 30))).toBe(seriesKey(new Date(2026, 8, 1)));
  });

  it("does not collide across years", () => {
    expect(seriesKey(new Date(2025, 8, 1))).not.toBe(seriesKey(new Date(2026, 8, 1)));
  });
});

describe("parseInvoiceNumber", () => {
  it("reads a number back", () => {
    expect(parseInvoiceNumber("IA.09.26.007")).toEqual({
      month: 9,
      year: 2026,
      sequence: 7,
    });
  });

  it("round-trips whatever it formats", () => {
    for (const [date, seq] of [
      [new Date(2025, 5, 1), 1],
      [new Date(2026, 11, 1), 53],
      [new Date(2026, 0, 1), 420],
    ] as const) {
      const parsed = parseInvoiceNumber(formatInvoiceNumber(date, seq))!;
      expect(parsed.sequence).toBe(seq);
      expect(parsed.month).toBe(date.getMonth() + 1);
      expect(parsed.year).toBe(date.getFullYear());
    }
  });

  it("returns null rather than guessing at anything else", () => {
    // The import reads these off real documents; a near-miss must not be
    // silently accepted as a number it is not.
    for (const bad of [
      "", "IA.09.26", "IA/09/26/007", "INV-007", "IA.13.26.001",
      "IA.00.26.001", "IA.9.26.007", "ia.09.26.007", "IA.09.26.7",
    ]) {
      expect(parseInvoiceNumber(bad)).toBeNull();
    }
  });

  it("tolerates surrounding whitespace, which spreadsheets add", () => {
    expect(parseInvoiceNumber("  IA.09.26.007 ")).not.toBeNull();
  });
});

describe("sample numbers", () => {
  it("marks a sample credit note as sample AND as a credit note", () => {
    const n = formatSampleCreditNoteNumber(new Date(2026, 8, 4), 3);
    expect(n).toBe("SMP.CN.09.26.003");
    // The wipe and every "is this real?" check key off the SMP. prefix.
    expect(isSampleInvoiceNumber(n)).toBe(true);
  });
});

describe("the credit note series", () => {
  it("is CN.MM.YY.NNN, its own consecutive series", () => {
    // GST requires a credit note to carry its own serial, not an invoice one.
    expect(formatCreditNoteNumber(new Date(2026, 8, 4), 1)).toBe("CN.09.26.001");
    expect(formatCreditNoteNumber(new Date(2026, 8, 4), 42)).toBe("CN.09.26.042");
  });

  it("never shares a counter with the invoice series", () => {
    /*
      If it did, a credit note would consume an invoice number and leave a hole
      in the invoice sequence — which is a question from the department.
    */
    const date = new Date(2026, 8, 4);
    expect(creditNoteSeriesKey(date)).not.toBe(seriesKey(date));
  });

  it("resets monthly, like the invoice series", () => {
    expect(creditNoteSeriesKey(new Date(2026, 8, 30))).not.toBe(
      creditNoteSeriesKey(new Date(2026, 9, 1)),
    );
  });
});
