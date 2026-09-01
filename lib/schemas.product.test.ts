import { describe, expect, it } from "vitest";
import { productSchema } from "./schemas";

/**
 * The unit boundary: the form speaks rupees and percentages, the database
 * speaks paise and basis points, and lib/schemas.ts is the only place that
 * translates. TypeScript cannot check this — the reads on the far side go
 * through `any` — so it is checked here instead.
 */

const bi = (en: string) => ({ en, gu: en });

/** The minimum a product needs to parse, so each test says only its own point. */
function parse(overrides: Record<string, unknown> = {}) {
  return productSchema.safeParse({
    name: bi("FloraMax"),
    slug: "floramax",
    categoryLabel: bi("Biofertiliser"),
    tagline: bi("Stronger roots"),
    description: bi("A mycorrhizal biofertiliser."),
    ...overrides,
  });
}

const pack = (extra: Record<string, unknown>) => ({
  packSizes: [{ label: "25g sachet", unit: "g", ...extra }],
});

describe("prices become integer paise", () => {
  it("converts what a person typed", () => {
    const out = parse(pack({ mrp: "245.50" }));
    expect(out.success && out.data.packSizes[0].mrpPaise).toBe(24550);
  });

  it("holds a value a float would lose", () => {
    const out = parse(pack({ mrp: "12.35" }));
    expect(out.success && out.data.packSizes[0].mrpPaise).toBe(1235);
  });

  it("carries all four prices", () => {
    const out = parse(
      pack({ mrp: "250", farmerPrice: "230", dealerPrice: "195", cost: "130" }),
    );
    expect(out.success && out.data.packSizes[0]).toMatchObject({
      mrpPaise: 25000,
      farmerPricePaise: 23000,
      dealerPricePaise: 19500,
      costPaise: 13000,
    });
  });

  it("leaves a blank price unset rather than zero", () => {
    // An unpriced pack must not read as free.
    const out = parse(pack({ mrp: "", dealerPrice: undefined }));
    expect(out.success && out.data.packSizes[0].mrpPaise).toBeUndefined();
    expect(out.success && out.data.packSizes[0].dealerPricePaise).toBeUndefined();
  });

  it("rejects something that is not a number, instead of storing zero", () => {
    const out = parse(pack({ mrp: "abc" }));
    expect(out.success).toBe(false);
    expect(out.success === false && out.error.issues[0].message).toContain("MRP");
  });

  it("rejects a negative price", () => {
    expect(parse(pack({ cost: "-5" })).success).toBe(false);
  });

  it("no longer emits the old rupee field names", () => {
    // The whole point: one representation, not two that drift apart.
    const out = parse(pack({ mrp: "245" }));
    expect(out.success && out.data.packSizes[0]).not.toHaveProperty("mrp");
    expect(out.success && out.data.packSizes[0]).not.toHaveProperty("dealerPrice");
  });
});

describe("the GST rate becomes basis points", () => {
  it("converts a whole percentage", () => {
    const out = parse({ gstRatePercent: 5 });
    expect(out.success && out.data.gstRateBps).toBe(500);
  });

  it("converts a half percentage exactly", () => {
    // 2.5 × 100 is 249.99999999999997 without the rounding.
    const out = parse({ gstRatePercent: 2.5 });
    expect(out.success && out.data.gstRateBps).toBe(250);
    expect(Number.isInteger(out.success && out.data.gstRateBps)).toBe(true);
  });

  it("defaults to zero when nothing is set", () => {
    const out = parse();
    expect(out.success && out.data.gstRateBps).toBe(0);
  });

  it("refuses a rate over 100%", () => {
    expect(parse({ gstRatePercent: 101 }).success).toBe(false);
  });

  it("no longer emits the percentage", () => {
    const out = parse({ gstRatePercent: 18 });
    expect(out.success && out.data).not.toHaveProperty("gstRatePercent");
  });
});
