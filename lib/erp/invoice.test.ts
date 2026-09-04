import { describe, expect, it } from "vitest";
import { computeInvoice } from "./tax";
import {
  InvoiceError,
  creditDiscount,
  resolveCreditPicks,
  snapshotLine,
  type DraftLine,
  type LineProduct,
} from "./invoice";

/**
 * The rules that decide what ends up on an invoice line.
 *
 * `snapshotLine` is where "the rate comes from the product, never from the
 * request" is actually enforced — the single most important rule in the ERP,
 * because it is what stops a GST rate being wrong in two places at once.
 */

const floraMax: LineProduct = {
  name: { en: "FloraMax" },
  hsnCode: "31010099",
  gstRateBps: 500,
  packSizes: [{ label: "25g sachet", unitsPerBox: 10 }],
};

const line = (over: Partial<DraftLine> = {}): DraftLine => ({
  productId: "abc",
  packLabel: "25g sachet",
  quantity: 10,
  unitPricePaise: 24500,
  ...over,
});

describe("the rate and HSN come from the product", () => {
  it("takes them from the record, not the request", () => {
    const out = snapshotLine(line(), floraMax, 0);
    expect(out.tax.gstRateBps).toBe(500);
    expect(out.tax.hsn).toBe("31010099");
  });

  it("ignores a rate the caller tries to send", () => {
    // The whole point: a line cannot carry its own rate.
    const sneaky = { ...line(), gstRateBps: 0, hsn: "0000" } as DraftLine;
    const out = snapshotLine(sneaky, floraMax, 0);
    expect(out.tax.gstRateBps).toBe(500);
    expect(out.tax.hsn).toBe("31010099");
  });

  it("does accept the price, because a negotiated price is real", () => {
    expect(snapshotLine(line({ unitPricePaise: 19500 }), floraMax, 0).tax.unitPricePaise)
      .toBe(19500);
  });
});

describe("what it refuses", () => {
  it("refuses a product with no GST rate rather than charging 0%", () => {
    // Zero is a legitimate rate, so "unset" must not be able to look like one.
    const unpriced: LineProduct = { ...floraMax, gstRateBps: undefined };
    expect(() => snapshotLine(line(), unpriced, 0)).toThrow(InvoiceError);
    expect(() => snapshotLine(line(), unpriced, 0)).toThrow(/no GST rate/);
  });

  it("accepts a rate that is genuinely zero", () => {
    expect(snapshotLine(line(), { ...floraMax, gstRateBps: 0 }, 0).tax.gstRateBps).toBe(0);
  });

  it("refuses a product with no HSN code", () => {
    expect(() => snapshotLine(line(), { ...floraMax, hsnCode: "" }, 0)).toThrow(/HSN/);
  });

  it("refuses a product that has vanished", () => {
    expect(() => snapshotLine(line(), undefined, 0)).toThrow(/no longer exists/);
  });

  it("refuses a zero, negative or fractional quantity", () => {
    for (const quantity of [0, -3, 2.5]) {
      expect(() => snapshotLine(line({ quantity }), floraMax, 0)).toThrow(/quantity/);
    }
  });

  it("refuses a price that is not whole paise", () => {
    expect(() => snapshotLine(line({ unitPricePaise: 245.5 }), floraMax, 0)).toThrow(/price/);
    expect(() => snapshotLine(line({ unitPricePaise: -100 }), floraMax, 0)).toThrow(/price/);
  });

  it("refuses a discount over 100% or below zero", () => {
    expect(() =>
      snapshotLine(line({ discountType: "percent", discountValue: 10_001 }), floraMax, 0),
    ).toThrow(/100%/);
    expect(() => snapshotLine(line({ discountValue: -5 }), floraMax, 0)).toThrow(/discount/);
    expect(() => snapshotLine(line({ discountValue: 2.5 }), floraMax, 0)).toThrow(/discount/);
  });

  it("says which line is wrong, counting from one", () => {
    expect(() => snapshotLine(line({ quantity: 0 }), floraMax, 2)).toThrow(/^Line 3:/);
  });
});

describe("the snapshot carries what the tax engine must not", () => {
  it("keeps the product id and pack label beside the tax input", () => {
    const out = snapshotLine(line(), floraMax, 0);
    expect(out.productId).toBe("abc");
    expect(out.packLabel).toBe("25g sachet");
    expect(out.tax).not.toHaveProperty("productId");
  });

  it("describes the line as product and pack", () => {
    expect(snapshotLine(line(), floraMax, 0).tax.description).toBe("FloraMax — 25g sachet");
  });
});

describe("end to end, without a database", () => {
  it("a two-line intra-state invoice is internally consistent", () => {
    const other: LineProduct = {
      name: { en: "Mycorrhizal" },
      hsnCode: "31010092",
      gstRateBps: 1800,
      packSizes: [{ label: "250g canister" }],
    };
    const snapshots = [
      snapshotLine(line({ quantity: 12 }), floraMax, 0),
      snapshotLine(
        { productId: "def", packLabel: "250g canister", quantity: 3, unitPricePaise: 99950 },
        other,
        1,
      ),
    ];
    const invoice = computeInvoice(snapshots.map((s) => s.tax), "intra");

    expect(invoice.igstPaise).toBe(0);
    expect(invoice.cgstPaise + invoice.sgstPaise).toBe(invoice.totalTaxPaise);
    expect(invoice.grossPaise + invoice.roundOffPaise).toBe(invoice.grandTotalPaise);
    expect(invoice.grandTotalPaise % 100).toBe(0);
    expect(invoice.byRate.map((r) => r.gstRateBps)).toEqual([500, 1800]);
  });

  it("the same lines inter-state charge IGST and the same total tax", () => {
    const snapshots = [snapshotLine(line(), floraMax, 0)];
    const intra = computeInvoice(snapshots.map((s) => s.tax), "intra");
    const inter = computeInvoice(snapshots.map((s) => s.tax), "inter");
    expect(inter.igstPaise).toBe(intra.totalTaxPaise);
    expect(inter.cgstPaise + inter.sgstPaise).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Credit notes                                                               */
/* -------------------------------------------------------------------------- */

/**
 * What a credit note is allowed to reverse.
 *
 * Every case here is about the same failure: crediting more than was sold.
 * That is not a display bug — it is a smaller GST liability on a return that
 * has been filed, and it is the direction nobody goes looking in.
 */

const sold = (...quantities: number[]) => quantities.map((quantity) => ({ quantity }));

describe("credit picks — the whole invoice", () => {
  it("reverses every line at its full quantity when none are named", () => {
    expect(resolveCreditPicks(sold(10, 4), undefined)).toEqual([
      { index: 0, quantity: 10 },
      { index: 1, quantity: 4 },
    ]);
  });

  it("reverses only what is LEFT after an earlier credit", () => {
    // "Credit the rest" is one action, not arithmetic done by hand.
    const already = new Map([[0, 6]]);
    expect(resolveCreditPicks(sold(10, 4), undefined, already)).toEqual([
      { index: 0, quantity: 4 },
      { index: 1, quantity: 4 },
    ]);
  });

  it("drops a line that has already been credited in full", () => {
    const already = new Map([[0, 10]]);
    expect(resolveCreditPicks(sold(10, 4), undefined, already)).toEqual([
      { index: 1, quantity: 4 },
    ]);
  });

  it("refuses when there is nothing left to credit at all", () => {
    const already = new Map([
      [0, 10],
      [1, 4],
    ]);
    expect(() => resolveCreditPicks(sold(10, 4), undefined, already)).toThrow(InvoiceError);
  });
});

describe("credit picks — named lines", () => {
  it("takes the lines asked for", () => {
    expect(resolveCreditPicks(sold(10, 4), [{ index: 1, quantity: 2 }])).toEqual([
      { index: 1, quantity: 2 },
    ]);
  });

  it("refuses a line that is not on the invoice", () => {
    expect(() => resolveCreditPicks(sold(10), [{ index: 5, quantity: 1 }])).toThrow(
      /not on that invoice/,
    );
  });

  it("refuses crediting more than was invoiced", () => {
    expect(() => resolveCreditPicks(sold(10), [{ index: 0, quantity: 11 }])).toThrow(
      /only 10 were invoiced/,
    );
  });

  it("refuses a fractional or negative quantity", () => {
    expect(() => resolveCreditPicks(sold(10), [{ index: 0, quantity: 2.5 }])).toThrow(InvoiceError);
    expect(() => resolveCreditPicks(sold(10), [{ index: 0, quantity: -3 }])).toThrow(InvoiceError);
    expect(() => resolveCreditPicks(sold(10), [{ index: 0, quantity: 0 }])).toThrow(InvoiceError);
  });

  it("sums a line named twice instead of letting it double-credit", () => {
    /*
      The bypass this exists for: five and five against a line of five passes
      any per-pick check and credits ten. Merged first, it is one pick of ten
      and is refused.
    */
    expect(() =>
      resolveCreditPicks(sold(5), [
        { index: 0, quantity: 5 },
        { index: 0, quantity: 5 },
      ]),
    ).toThrow(/only 5 were invoiced/);
  });

  it("merges a line named twice when the total is legitimate", () => {
    expect(
      resolveCreditPicks(sold(10), [
        { index: 0, quantity: 3 },
        { index: 0, quantity: 4 },
      ]),
    ).toEqual([{ index: 0, quantity: 7 }]);
  });

  it("counts what an earlier credit note already took", () => {
    const already = new Map([[0, 8]]);
    expect(resolveCreditPicks(sold(10), [{ index: 0, quantity: 2 }], already)).toEqual([
      { index: 0, quantity: 2 },
    ]);
    expect(() => resolveCreditPicks(sold(10), [{ index: 0, quantity: 3 }], already)).toThrow(
      /only 2 of 10 are left/,
    );
  });
});

describe("a credit note cancels its invoice exactly", () => {
  it("negated quantities reverse the totals to zero", () => {
    // The reason amounts are stored negative: every sum just works.
    const original = computeInvoice(
      [
        { description: "FloraMax", hsn: "31010099", quantity: 7, unitPricePaise: 24500, gstRateBps: 500 },
        { description: "MycoBoost", hsn: "31010099", quantity: 3, unitPricePaise: 99900, gstRateBps: 1800 },
      ],
      "intra",
    );
    const credit = computeInvoice(
      [
        { description: "FloraMax", hsn: "31010099", quantity: -7, unitPricePaise: 24500, gstRateBps: 500 },
        { description: "MycoBoost", hsn: "31010099", quantity: -3, unitPricePaise: 99900, gstRateBps: 1800 },
      ],
      "intra",
    );

    expect(original.grandTotalPaise + credit.grandTotalPaise).toBe(0);
    expect(original.cgstPaise + credit.cgstPaise).toBe(0);
    expect(original.sgstPaise + credit.sgstPaise).toBe(0);
    expect(original.subtotalPaise + credit.subtotalPaise).toBe(0);
  });
});

describe("discounts on a line", () => {
  it("resolves a percentage against the line's gross", () => {
    // 10 × ₹245 = ₹2,450; 10% = ₹245.00
    const out = snapshotLine(line({ discountType: "percent", discountValue: 1000 }), floraMax, 0);
    expect(out.tax.discountPaise).toBe(24500);
    expect(out.discountType).toBe("percent");
    expect(out.discountValue).toBe(1000);
  });

  it("clamps a flat discount to the line rather than going negative", () => {
    const out = snapshotLine(line({ discountValue: 9_999_999 }), floraMax, 0);
    expect(out.tax.discountPaise).toBe(245000);
  });

  it("reads no discount as flat zero", () => {
    const out = snapshotLine(line(), floraMax, 0);
    expect(out.tax.discountPaise).toBe(0);
    expect(out.discountType).toBe("flat");
  });
});

describe("creditDiscount", () => {
  it("gives the whole discount back when the whole line is credited", () => {
    expect(creditDiscount(10000, 10, 0, 10)).toBe(10000);
  });

  it("splits it pro rata and the parts sum exactly, however it is cut", () => {
    // ₹100.01 over 3 pieces: 3334 + 3333 + 3334 = 10001.
    const a = creditDiscount(10001, 3, 0, 1);
    const b = creditDiscount(10001, 3, 1, 1);
    const c = creditDiscount(10001, 3, 2, 1);
    expect(a + b + c).toBe(10001);
    expect(creditDiscount(10001, 3, 0, 2) + creditDiscount(10001, 3, 2, 1)).toBe(10001);
  });

  it("is nothing for an undiscounted line", () => {
    expect(creditDiscount(0, 10, 0, 4)).toBe(0);
  });

  it("cancels a discounted invoice to exactly zero through the tax engine", () => {
    const sold = computeInvoice(
      [{ ...floraMax, description: "x", hsn: "1", quantity: 10, unitPricePaise: 10000, discountPaise: 10000, gstRateBps: 500 }],
      "intra",
    );
    const credited = computeInvoice(
      [{ description: "x", hsn: "1", quantity: -10, unitPricePaise: 10000, discountPaise: -creditDiscount(10000, 10, 0, 10), gstRateBps: 500 }],
      "intra",
    );
    expect(sold.grandTotalPaise).toBe(94500);
    expect(sold.grandTotalPaise + credited.grandTotalPaise).toBe(0);
  });
});

describe("boxes", () => {
  it("multiplies a box order out to pieces and keeps how it was ordered", () => {
    const out = snapshotLine(line({ quantity: 3, uom: "box" }), floraMax, 0);
    expect(out.tax.quantity).toBe(30);
    expect(out.uom).toBe("box");
    expect(out.boxes).toBe(3);
    expect(out.unitsPerBox).toBe(10);
    // Price stays per piece: 30 × ₹245.
    expect(out.tax.quantity * out.tax.unitPricePaise).toBe(30 * 24500);
  });

  it("refuses a box order on a pack that is not sold by the box", () => {
    const loose: LineProduct = { ...floraMax, packSizes: [{ label: "25g sachet" }] };
    expect(() => snapshotLine(line({ quantity: 3, uom: "box" }), loose, 0)).toThrow(/by the box/);
  });

  it("leaves a piece order alone", () => {
    const out = snapshotLine(line({ quantity: 7 }), floraMax, 0);
    expect(out.tax.quantity).toBe(7);
    expect(out.uom).toBe("piece");
    expect(out.boxes).toBe(0);
  });
});

describe("seasonal schemes on a line", () => {
  const kharif = {
    id: "k",
    name: "Kharif 10%",
    discountType: "percent" as const,
    discountValue: 1000,
    productIds: [],
    channel: "both" as const,
    startAt: "2026-06-01T00:00:00+05:30",
    endAt: "2026-09-01T00:00:00+05:30",
    enabled: true,
  };
  const during = { schemes: [kharif], channel: "b2c", at: new Date("2026-07-10T09:00:00+05:30") };

  it("fills a blank discount from the live scheme, naming it", () => {
    const out = snapshotLine(line(), floraMax, 0, during);
    // 10 × ₹245 = ₹2,450; 10% is ₹245.
    expect(out.tax.discountPaise).toBe(24_500);
    expect(out.discountType).toBe("percent");
    expect(out.discountValue).toBe(1000);
    expect(out.schemeId).toBe("k");
    expect(out.schemeName).toBe("Kharif 10%");
  });

  it("a typed discount wins, even a smaller one", () => {
    const out = snapshotLine(line({ discountType: "flat", discountValue: 500 }), floraMax, 0, during);
    expect(out.tax.discountPaise).toBe(500);
    expect(out.schemeId).toBeNull();
    expect(out.schemeName).toBe("");
  });

  it("applies nothing outside the window, or with no context at all", () => {
    const after = { ...during, at: new Date("2026-09-01T00:00:00+05:30") };
    expect(snapshotLine(line(), floraMax, 0, after).tax.discountPaise).toBe(0);
    expect(snapshotLine(line(), floraMax, 0).schemeId).toBeNull();
  });

  it("respects the scheme's channel and product list", () => {
    const dealers = { ...kharif, id: "d", channel: "b2b" as const };
    expect(snapshotLine(line(), floraMax, 0, { ...during, schemes: [dealers] }).schemeId).toBeNull();
    expect(snapshotLine(line(), floraMax, 0, { ...during, schemes: [dealers], channel: "b2b" }).schemeId).toBe("d");
    const other = { ...kharif, id: "o", productIds: ["zzz"] };
    expect(snapshotLine(line(), floraMax, 0, { ...during, schemes: [other] }).schemeId).toBeNull();
  });
});
