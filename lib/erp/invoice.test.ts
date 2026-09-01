import { describe, expect, it } from "vitest";
import { computeInvoice } from "./tax";
import { InvoiceError, snapshotLine, type DraftLine, type LineProduct } from "./invoice";

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
  packSizes: [{ label: "25g sachet" }],
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
