import { describe, expect, it } from "vitest";
import {
  activeSchemes,
  describeSchemeDiscount,
  pickScheme,
  schemeCovers,
  schemeStatus,
  type SchemeRule,
} from "./schemes";

const P = "64a000000000000000000001";
const Q = "64a000000000000000000002";

const kharif: SchemeRule = {
  id: "k",
  name: "Kharif 10%",
  discountType: "percent",
  discountValue: 1000,
  productIds: [],
  channel: "both",
  startAt: "2026-06-01T00:00:00+05:30",
  endAt: "2026-09-01T00:00:00+05:30",
  enabled: true,
};

const dealerFlat: SchemeRule = {
  id: "d",
  name: "Dealer ₹50",
  discountType: "flat",
  discountValue: 5000,
  productIds: [P],
  channel: "b2b",
  startAt: "2026-07-01T00:00:00+05:30",
  endAt: "2026-09-01T00:00:00+05:30",
  enabled: true,
};

const during = new Date("2026-08-15T10:00:00+05:30");

describe("schemeStatus", () => {
  it("is active between start (inclusive) and end (exclusive)", () => {
    expect(schemeStatus(kharif, new Date("2026-06-01T00:00:00+05:30"))).toBe("active");
    expect(schemeStatus(kharif, new Date("2026-08-31T23:59:59+05:30"))).toBe("active");
    expect(schemeStatus(kharif, new Date("2026-09-01T00:00:00+05:30"))).toBe("expired");
  });

  it("is upcoming before it starts and off when disabled, whatever the dates", () => {
    expect(schemeStatus(kharif, new Date("2026-05-31T23:59:59+05:30"))).toBe("upcoming");
    expect(schemeStatus({ ...kharif, enabled: false }, during)).toBe("off");
  });

  it("filters the live ones", () => {
    expect(activeSchemes([kharif, dealerFlat, { ...kharif, id: "x", enabled: false }], during).map((s) => s.id)).toEqual(["k", "d"]);
    expect(activeSchemes([kharif, dealerFlat], new Date("2026-06-15T00:00:00+05:30")).map((s) => s.id)).toEqual(["k"]);
  });
});

describe("schemeCovers", () => {
  it("an empty product list covers every product; a named list only those", () => {
    expect(schemeCovers(kharif, { productId: Q, channel: "b2c" })).toBe(true);
    expect(schemeCovers(dealerFlat, { productId: Q, channel: "b2b" })).toBe(false);
    expect(schemeCovers(dealerFlat, { productId: P, channel: "b2b" })).toBe(true);
  });

  it("a channel scheme does not reach the other channel, or an unknown one", () => {
    expect(schemeCovers(dealerFlat, { productId: P, channel: "b2c" })).toBe(false);
    expect(schemeCovers(dealerFlat, { productId: P, channel: "" })).toBe(false);
    expect(schemeCovers(kharif, { productId: P, channel: "" })).toBe(true);
  });
});

describe("pickScheme", () => {
  it("returns null when nothing live covers the line", () => {
    expect(pickScheme([kharif], { productId: P, channel: "b2c" }, 100_000, new Date("2026-10-01T00:00:00+05:30"))).toBeNull();
    expect(pickScheme([], { productId: P, channel: "b2c" }, 100_000, during)).toBeNull();
  });

  it("resolves the discount on the line, clamped like a typed one", () => {
    expect(pickScheme([kharif], { productId: P, channel: "b2c" }, 24_500, during)).toEqual({
      scheme: kharif,
      discountPaise: 2_450,
    });
    // ₹50 off a ₹30 line is a free line, not a negative one.
    expect(pickScheme([dealerFlat], { productId: P, channel: "b2b" }, 3_000, during)?.discountPaise).toBe(3_000);
  });

  it("takes the LARGER discount on this line when two overlap", () => {
    // 10% of ₹200 is ₹20; the flat ₹50 wins.
    expect(pickScheme([kharif, dealerFlat], { productId: P, channel: "b2b" }, 20_000, during)?.scheme.id).toBe("d");
    // 10% of ₹2,000 is ₹200; the percentage wins.
    expect(pickScheme([kharif, dealerFlat], { productId: P, channel: "b2b" }, 200_000, during)?.scheme.id).toBe("k");
  });

  it("breaks a tie by the earlier start", () => {
    const later: SchemeRule = { ...kharif, id: "later", name: "Also 10%", startAt: "2026-07-15T00:00:00+05:30" };
    expect(pickScheme([later, kharif], { productId: P, channel: "b2c" }, 10_000, during)?.scheme.id).toBe("k");
  });

  it("ignores a scheme that would take nothing off", () => {
    expect(pickScheme([{ ...kharif, discountValue: 0 }], { productId: P, channel: "b2c" }, 10_000, during)).toBeNull();
  });
});

describe("describeSchemeDiscount", () => {
  it("says percent and rupees as a person would", () => {
    expect(describeSchemeDiscount({ discountType: "percent", discountValue: 1000 })).toBe("10% off");
    expect(describeSchemeDiscount({ discountType: "percent", discountValue: 1250 })).toBe("12.5% off");
    expect(describeSchemeDiscount({ discountType: "flat", discountValue: 5000 })).toBe("₹50 off");
    expect(describeSchemeDiscount({ discountType: "flat", discountValue: 4950 })).toBe("₹49.50 off");
  });
});
