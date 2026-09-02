import { describe, expect, it } from "vitest";
import {
  formatIstDate,
  formatIstDateLong,
  formatIstDateTime,
  istDateTimeInputValue,
  istDay,
  istFinancialYear,
  istMonth,
  istMonthStart,
  istParts,
  istYear,
  parseIstDateTimeInput,
} from "./time";

/**
 * The 05:30 window.
 *
 * Every test here is a date that UTC and IST disagree about. They are the only
 * ones that matter — a mid-afternoon invoice was never in danger, and a fix
 * that only handles mid-afternoon is not a fix.
 */

/** 05:00 IST on 1 October 2026 — stored as the previous day in UTC. */
const EARLY_FIRST = new Date("2026-09-30T23:30:00.000Z");
/** 23:59 IST on 30 September 2026. Genuinely September, both ways. */
const LATE_LAST = new Date("2026-09-30T18:29:00.000Z");
/** 06:00 IST on 1 October 2026 — past the window, October either way. */
const AFTER_WINDOW = new Date("2026-10-01T00:30:00.000Z");

describe("reading the calendar in IST", () => {
  it("calls 05:00 on 1 October October, not September", () => {
    // In UTC this instant is 2026-09-30T23:30 — the whole bug in one assertion.
    expect(istYear(EARLY_FIRST)).toBe(2026);
    expect(istMonth(EARLY_FIRST)).toBe(10);
    expect(istDay(EARLY_FIRST)).toBe(1);
  });

  it("still calls the last minute of September September", () => {
    expect(istMonth(LATE_LAST)).toBe(9);
    expect(istDay(LATE_LAST)).toBe(30);
  });

  it("agrees with UTC once the window has passed", () => {
    expect(istMonth(AFTER_WINDOW)).toBe(10);
    expect(istDay(AFTER_WINDOW)).toBe(1);
  });

  it("rolls the year at midnight IST, not at midnight UTC", () => {
    // 00:30 IST on 1 January 2027 = 19:00 UTC on 31 December 2026.
    const newYear = new Date("2026-12-31T19:00:00.000Z");
    expect(istYear(newYear)).toBe(2027);
    expect(istMonth(newYear)).toBe(1);
    expect(istDay(newYear)).toBe(1);
  });

  it("returns the three fields together consistently", () => {
    expect(istParts(EARLY_FIRST)).toEqual({ year: 2026, month: 10, day: 1 });
  });
});

describe("month boundaries as query bounds", () => {
  it("starts October at 18:30 UTC on 30 September", () => {
    // Midnight in India is half past six the previous evening in London.
    expect(istMonthStart(2026, 10).toISOString()).toBe("2026-09-30T18:30:00.000Z");
  });

  it("puts an invoice raised at 05:00 IST on the 1st inside that month", () => {
    /*
      The failing case. With UTC bounds this instant was BELOW the start of
      October and fell into September's GST return.
    */
    const from = istMonthStart(2026, 10);
    const to = istMonthStart(2026, 11);
    expect(EARLY_FIRST >= from).toBe(true);
    expect(EARLY_FIRST < to).toBe(true);
  });

  it("keeps the last minute of September out of October", () => {
    expect(LATE_LAST < istMonthStart(2026, 10)).toBe(true);
  });

  it("hands December to January of the next year", () => {
    expect(istMonthStart(2026, 13).toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });

  it("has no gap and no overlap between consecutive months", () => {
    // The end of one month is the start of the next, exactly.
    for (let month = 1; month <= 12; month++) {
      expect(istMonthStart(2026, month + 1).getTime()).toBe(
        istMonthStart(month === 12 ? 2027 : 2026, month === 12 ? 1 : month + 1).getTime(),
      );
    }
  });
});

describe("the financial year", () => {
  it("runs April to March", () => {
    expect(istFinancialYear(new Date("2026-04-15T06:00:00.000Z"))).toBe("26-27");
    expect(istFinancialYear(new Date("2026-03-15T06:00:00.000Z"))).toBe("25-26");
  });

  it("turns over at midnight IST on 1 April, not at midnight UTC", () => {
    /*
      03:00 IST on 1 April 2026 is 31 March in UTC. Read the UTC month and this
      invoice is stamped with the wrong financial year — on a document the CA
      files by.
    */
    const firstOfApril = new Date("2026-03-31T21:30:00.000Z");
    expect(istMonth(firstOfApril)).toBe(4);
    expect(istFinancialYear(firstOfApril)).toBe("26-27");
  });

  it("keeps the last evening of March in the old year", () => {
    // 23:00 IST on 31 March 2026.
    expect(istFinancialYear(new Date("2026-03-31T17:30:00.000Z"))).toBe("25-26");
  });
});

describe("the datetime-local round trip", () => {
  it("shows a 09:00 IST schedule as 09:00, not 03:30", () => {
    // Stored instant for "publish at 9am in Gujarat".
    const nineAmIst = new Date("2026-09-04T03:30:00.000Z");
    expect(istDateTimeInputValue(nineAmIst)).toBe("2026-09-04T09:00");
  });

  it("reads a typed 09:00 back as 09:00 IST, not 09:00 UTC", () => {
    /*
      The half of the bug the director would actually feel: typing 9am and
      having the post go out at half past two in the afternoon.
    */
    expect(parseIstDateTimeInput("2026-09-04T09:00")?.toISOString()).toBe(
      "2026-09-04T03:30:00.000Z",
    );
  });

  it("is an exact inverse in both directions", () => {
    for (const iso of [
      "2026-09-04T03:30:00.000Z",
      "2026-12-31T18:30:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-03-31T21:30:00.000Z",
    ]) {
      const value = istDateTimeInputValue(new Date(iso));
      expect(parseIstDateTimeInput(value)?.toISOString()).toBe(iso);
    }
  });

  it("passes a string that already carries a zone straight through", () => {
    // Only the bare form is ambiguous, and only the bare form is ours to read.
    expect(parseIstDateTimeInput("2026-09-04T03:30:00.000Z")?.toISOString()).toBe(
      "2026-09-04T03:30:00.000Z",
    );
  });

  it("returns null for blank or unparseable input", () => {
    expect(parseIstDateTimeInput("")).toBeNull();
    expect(parseIstDateTimeInput("   ")).toBeNull();
    expect(parseIstDateTimeInput("not a date")).toBeNull();
  });
});

describe("formatting a date for a document", () => {
  it("writes dd-mm-yyyy for the GST portal", () => {
    expect(formatIstDate(new Date("2026-09-04T06:00:00.000Z"))).toBe("04-09-2026");
  });

  it("writes the IST day, not the UTC one", () => {
    // The date printed on the invoice and on the filed CSV.
    expect(formatIstDate(EARLY_FIRST)).toBe("01-10-2026");
    expect(formatIstDateLong(EARLY_FIRST)).toBe("01 Oct 2026");
  });

  it("writes a timestamp on the IST clock", () => {
    // 23:30Z on the 30th is 05:00 on the 1st in India.
    expect(formatIstDateTime(EARLY_FIRST)).toBe("01 Oct 2026, 05:00");
    expect(formatIstDateTime(new Date("2026-09-04T08:35:00.000Z"))).toBe("04 Sep 2026, 14:05");
  });

  it("pads a single-digit day and month", () => {
    expect(formatIstDate(new Date("2026-01-05T06:00:00.000Z"))).toBe("05-01-2026");
    expect(formatIstDateLong(new Date("2026-01-05T06:00:00.000Z"))).toBe("05 Jan 2026");
  });
});
