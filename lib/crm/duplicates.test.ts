import { describe, expect, it } from "vitest";
import { duplicatePhoneFilter, phoneKey, phoneMatchPattern } from "./duplicates";

describe("phoneKey", () => {
  it("keeps a plain ten-digit number", () => {
    expect(phoneKey("9825012345")).toBe("9825012345");
  });

  it("strips the shapes the sheets actually carry", () => {
    expect(phoneKey("+91 98250 12345")).toBe("9825012345");
    expect(phoneKey("098250 12345")).toBe("9825012345");
    expect(phoneKey("+91-98250-12345")).toBe("9825012345");
    expect(phoneKey("(98250) 12345")).toBe("9825012345");
  });

  it("refuses anything it cannot be confident about", () => {
    // A landline, a partial entry, junk. Reporting a duplicate against a
    // number this cannot read would be worse than reporting none.
    expect(phoneKey("")).toBe("");
    expect(phoneKey("98250")).toBe("");
    expect(phoneKey("12345678901234")).toBe("");
    expect(phoneKey("not a number")).toBe("");
  });
});

describe("phoneMatchPattern", () => {
  const pattern = phoneMatchPattern("9825012345")!;

  it("matches the same number however it was written down", () => {
    for (const stored of [
      "9825012345",
      "+919825012345",
      "+91 98250 12345",
      "098250 12345",
      "98250-12345",
      "(98250) 12345",
    ]) {
      expect(pattern.test(stored), stored).toBe(true);
    }
  });

  it("does not match a different number that merely ends the same", () => {
    // The anchor exists for this: 79825012345 is not 9825012345.
    expect(pattern.test("7 9825012345")).toBe(false);
    expect(pattern.test("9825012346")).toBe(false);
    expect(pattern.test("98250123450")).toBe(false);
  });

  it("returns null rather than a pattern for an unusable key", () => {
    expect(phoneMatchPattern("")).toBeNull();
    expect(phoneMatchPattern("98250")).toBeNull();
    expect(phoneMatchPattern("+919825012345")).toBeNull();
  });
});

describe("duplicatePhoneFilter", () => {
  it("looks at both numbers on a record", () => {
    const filter = duplicatePhoneFilter("9825012345")!;
    expect(Object.keys(filter)).toEqual(["$or"]);
    expect(filter.$or).toHaveLength(2);
  });

  it("excludes the record being edited, so it is not its own twin", () => {
    const filter = duplicatePhoneFilter("9825012345", "abc123")!;
    expect(filter._id).toEqual({ $ne: "abc123" });
  });

  it("is null when there is nothing to look up", () => {
    expect(duplicatePhoneFilter("")).toBeNull();
  });
});
