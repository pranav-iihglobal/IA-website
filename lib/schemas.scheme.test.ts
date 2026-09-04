import { describe, expect, it } from "vitest";
import { schemeSchema } from "./schemas";

/**
 * The scheme form's schema, at the two places it can go wrong: the checks
 * that read two fields at once, and the IST dates.
 */

const valid = {
  name: "Kharif 2026",
  discountType: "percent",
  discount: "10",
  productIds: [],
  channel: "both",
  startAt: "2026-06-01T00:00",
  endAt: "2026-09-01T00:00",
  enabled: true,
  notes: "",
};

describe("schemeSchema", () => {
  it("stores a percentage as basis points and rupees as paise", () => {
    const percent = schemeSchema.parse(valid);
    expect(percent.discountValue).toBe(1000);
    expect("discount" in percent).toBe(false);
    const flat = schemeSchema.parse({ ...valid, discountType: "flat", discount: "49.50" });
    expect(flat.discountValue).toBe(4950);
  });

  it("reads the dates as IST", () => {
    const out = schemeSchema.parse(valid);
    expect(out.startAt.toISOString()).toBe("2026-05-31T18:30:00.000Z");
    expect(out.endAt.toISOString()).toBe("2026-08-31T18:30:00.000Z");
  });

  it("refuses more than 100%, under the discount field", () => {
    const result = schemeSchema.safeParse({ ...valid, discount: "150" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => [i.path.join("."), i.message])).toContainEqual([
      "discount",
      "A percentage is between 0 and 100",
    ]);
  });

  it("refuses an end at or before the start, under the end field", () => {
    const result = schemeSchema.safeParse({ ...valid, endAt: valid.startAt });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join("."))).toContain("endAt");
  });

  it("names a blank start without throwing from the date comparison", () => {
    const result = schemeSchema.safeParse({ ...valid, startAt: "", discount: "150" });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((i) => i.message) ?? [];
    expect(messages).toContain("When does it start?");
    expect(messages).toContain("A percentage is between 0 and 100");
  });

  it("refuses a scheme that takes nothing off", () => {
    expect(schemeSchema.safeParse({ ...valid, discount: "0" }).success).toBe(false);
    expect(schemeSchema.safeParse({ ...valid, discount: "" }).success).toBe(false);
  });
});
