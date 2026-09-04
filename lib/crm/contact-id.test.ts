import { describe, expect, it } from "vitest";
import {
  contactSeriesKey,
  contactSeriesLetter,
  formatContactId,
  isAllocatedSeries,
  parseContactId,
  seriesChanges,
} from "./contact-id";

/*
  The pure half. Allocation is atomic inside MongoDB and is proved against a
  real connection by scripts/check-erp.ts, the same way invoice numbers are.
*/

describe("contactSeriesLetter", () => {
  it("gives dealers their own series, as the sheets do", () => {
    expect(contactSeriesLetter("customer", "b2c")).toBe("C");
    expect(contactSeriesLetter("customer", "b2b")).toBe("B");
    expect(contactSeriesLetter("lead", "")).toBe("L");
  });

  it("treats a lead as a lead whatever its channel says", () => {
    // Channel is only meaningful on a customer; a stray value must not
    // number a lead in the dealer series.
    expect(contactSeriesLetter("lead", "b2b")).toBe("L");
  });
});

describe("formatContactId", () => {
  it("pads to three digits", () => {
    expect(formatContactId("C", 34)).toBe("IKS-C-034");
    expect(formatContactId("B", 1)).toBe("IKS-B-001");
  });

  it("grows past 999 rather than wrapping", () => {
    expect(formatContactId("L", 1234)).toBe("IKS-L-1234");
  });

  it("can carry the sample prefix", () => {
    expect(formatContactId("L", 7, "DEMO")).toBe("DEMO-L-007");
  });
});

describe("parseContactId", () => {
  it("reads back what formatContactId wrote", () => {
    expect(parseContactId("IKS-C-034")).toEqual({ prefix: "IKS", letter: "C", sequence: 34 });
    expect(parseContactId("IKS-L-1234")).toEqual({ prefix: "IKS", letter: "L", sequence: 1234 });
  });

  it("is loose about the prefix and letter — the leads database is IKS-D-", () => {
    expect(parseContactId("IKS-D-2403")).toEqual({ prefix: "IKS", letter: "D", sequence: 2403 });
    expect(parseContactId("DEMO-C-009")).toEqual({ prefix: "DEMO", letter: "C", sequence: 9 });
  });

  it("forgives case and whitespace, as a typed id arrives", () => {
    expect(parseContactId("  iks-c-034 ")).toEqual({ prefix: "IKS", letter: "C", sequence: 34 });
  });

  it("returns null for anything that is not the shape", () => {
    expect(parseContactId("")).toBeNull();
    expect(parseContactId("IKS-034")).toBeNull();
    expect(parseContactId("IKS-C-")).toBeNull();
    expect(parseContactId("34")).toBeNull();
    expect(parseContactId("IKS-CC-034")).toBeNull();
  });
});

describe("isAllocatedSeries", () => {
  it("is true only for the three real series", () => {
    expect(isAllocatedSeries(parseContactId("IKS-C-034")!)).toBe(true);
    expect(isAllocatedSeries(parseContactId("IKS-B-001")!)).toBe(true);
    expect(isAllocatedSeries(parseContactId("IKS-L-012")!)).toBe(true);
  });

  it("never seeds a real series from the leads database or from sample data", () => {
    expect(isAllocatedSeries(parseContactId("IKS-D-2403")!)).toBe(false);
    expect(isAllocatedSeries(parseContactId("DEMO-C-001")!)).toBe(false);
  });
});

describe("series keys", () => {
  it("names a series by its letter", () => {
    expect(contactSeriesKey("C")).toBe("contact:C");
    expect(contactSeriesKey("L")).toBe("contact:L");
  });
});

describe("seriesChanges", () => {
  it("is true when a lead becomes a customer or a dealer", () => {
    expect(seriesChanges({ kind: "lead", channel: "" }, { kind: "customer", channel: "b2c" })).toBe(true);
    expect(seriesChanges({ kind: "lead", channel: "" }, { kind: "customer", channel: "b2b" })).toBe(true);
  });

  it("is true when a customer becomes a dealer", () => {
    expect(seriesChanges({ kind: "customer", channel: "b2c" }, { kind: "customer", channel: "b2b" })).toBe(true);
  });

  it("is false for an ordinary edit, so an id is never reissued for a phone change", () => {
    expect(seriesChanges({ kind: "customer", channel: "b2c" }, { kind: "customer", channel: "b2c" })).toBe(false);
    expect(seriesChanges({ kind: "lead", channel: "" }, { kind: "lead", channel: "" })).toBe(false);
  });
});
