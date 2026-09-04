import { describe, expect, it } from "vitest";
import {
  csvSize,
  currentPeriod,
  formatPeriod,
  parsePeriod,
  periodLabel,
  previousPeriod,
  sectionCounts,
} from "./gst-period";
import type { GstReturn } from "./gst";

describe("periods in the URL", () => {
  it("round-trips YYYY-MM", () => {
    expect(parsePeriod("2026-09")).toEqual({ year: 2026, month: 9 });
    expect(formatPeriod({ year: 2026, month: 9 })).toBe("2026-09");
    expect(periodLabel({ year: 2026, month: 9 })).toBe("September 2026");
  });

  it("refuses anything that is not a month", () => {
    for (const bad of ["2026-13", "2026-00", "2026-9", "26-09", "", undefined, null, "2026-09-01"]) {
      expect(parsePeriod(bad)).toBeNull();
    }
  });

  it("reckons the current month in IST", () => {
    // 23:30Z on 30 September is 1 October in India.
    expect(currentPeriod(new Date("2026-09-30T23:30:00Z"))).toEqual({ year: 2026, month: 10 });
  });

  it("steps back across a year", () => {
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(previousPeriod({ year: 2026, month: 6 })).toEqual({ year: 2026, month: 5 });
  });
});

describe("sectionCounts", () => {
  it("lists the five sections in filing order with their row counts", () => {
    const built = {
      b2b: [{}, {}],
      b2cs: [{}],
      cdnr: [],
      cdnur: [{}, {}, {}],
      totals: { taxableValuePaise: 0, cgstPaise: 0, sgstPaise: 0, igstPaise: 0, invoiceValuePaise: 0 },
      excludedCancelled: 0,
    } as unknown as GstReturn;
    const counts = sectionCounts(built, [{}, {}, {}, {}] as never);
    expect(counts.map((c) => [c.key, c.rows])).toEqual([
      ["b2b", 2],
      ["b2cs", 1],
      ["cdnr", 0],
      ["cdnur", 3],
      ["hsn", 4],
    ]);
  });
});

describe("csvSize", () => {
  it("says bytes under a kilobyte and whole kilobytes above", () => {
    expect(csvSize("a,b\n")).toBe("4 B");
    expect(csvSize("x".repeat(3000))).toBe("3 KB");
    // Multi-byte text counts bytes, not characters.
    expect(csvSize("₹".repeat(400))).toBe("1 KB");
  });
});
