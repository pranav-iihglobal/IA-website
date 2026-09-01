import { describe, expect, it } from "vitest";
import { b2bCsv, b2csCsv, buildGstReturn, isB2B, type ExportableInvoice } from "./gst";

/**
 * The return the CA files from.
 *
 * Every assertion here is about a filing, not a screen. The two that matter
 * most: a GSTIN — not a channel — decides B2B against B2CS, and a cancelled
 * invoice is not a supply.
 */

const rupees = (n: number) => n * 100;

function line(gstRateBps: number, taxable: number, inter = false) {
  const tax = Math.round((taxable * gstRateBps) / 10_000);
  const cgst = inter ? 0 : Math.trunc(tax / 2);
  return {
    gstRateBps,
    taxableValuePaise: taxable,
    cgstPaise: cgst,
    sgstPaise: inter ? 0 : tax - cgst,
    igstPaise: inter ? tax : 0,
  };
}

function invoice(over: Partial<ExportableInvoice> = {}): ExportableInvoice {
  return {
    number: "IA.09.26.001",
    issuedAt: "2026-09-04T00:00:00.000Z",
    status: "issued",
    placeOfSupplyStateCode: "24",
    supplyType: "intra",
    party: { name: "Yogeshbhai", businessName: "", gstin: "" },
    grandTotalPaise: rupees(1050),
    lines: [line(500, rupees(1000))],
    ...over,
  };
}

const withGstin = { name: "Agri Traders", businessName: "Agri Traders", gstin: "24AABCA1234B1Z5" };

describe("a GSTIN decides the section, not the channel", () => {
  it("puts a sale with a GSTIN in B2B", () => {
    const r = buildGstReturn([invoice({ party: withGstin })]);
    expect(r.b2b).toHaveLength(1);
    expect(r.b2cs).toHaveLength(0);
  });

  it("puts a sale without one in B2CS, even to a dealer", () => {
    // A dealer who never gave us a GSTIN is a B2C sale on the return.
    const r = buildGstReturn([
      invoice({ party: { name: "Big Dealer", businessName: "Big Dealer", gstin: "" } }),
    ]);
    expect(r.b2b).toHaveLength(0);
    expect(r.b2cs).toHaveLength(1);
  });

  it("treats whitespace as no GSTIN rather than as one", () => {
    expect(isB2B(invoice({ party: { name: "x", businessName: "", gstin: "   " } }))).toBe(false);
  });
});

describe("cancelled invoices", () => {
  it("are excluded entirely — a cancellation is not a supply", () => {
    const r = buildGstReturn([
      invoice({ number: "A", party: withGstin }),
      invoice({ number: "B", party: withGstin, status: "cancelled" }),
    ]);
    expect(r.b2b).toHaveLength(1);
    expect(r.b2b[0].invoiceNo).toBe("A");
  });

  it("are counted, so the difference from the invoice list is explainable", () => {
    const r = buildGstReturn([invoice({ status: "cancelled" })]);
    expect(r.excludedCancelled).toBe(1);
    expect(r.totals.taxableValuePaise).toBe(0);
  });
});

describe("one row per rate", () => {
  it("splits a mixed-rate invoice into two B2B rows", () => {
    // The portal reconciles rate by rate; a blended row would not file.
    const r = buildGstReturn([
      invoice({
        party: withGstin,
        lines: [line(500, rupees(1000)), line(1800, rupees(2000))],
      }),
    ]);
    expect(r.b2b).toHaveLength(2);
    expect(r.b2b.map((x) => x.gstRateBps)).toEqual([500, 1800]);
    expect(r.b2b.every((x) => x.invoiceNo === "IA.09.26.001")).toBe(true);
  });

  it("summarises B2CS per place of supply and rate", () => {
    const r = buildGstReturn([
      invoice({ number: "A", lines: [line(500, rupees(1000))] }),
      invoice({ number: "B", lines: [line(500, rupees(500))] }),
      invoice({ number: "C", placeOfSupplyStateCode: "27", lines: [line(500, rupees(300), true)] }),
    ]);
    expect(r.b2cs).toHaveLength(2);
    const gujarat = r.b2cs.find((x) => x.placeOfSupply === "24")!;
    expect(gujarat.taxableValuePaise).toBe(rupees(1500));
    expect(gujarat.invoices).toBe(2);
  });

  it("counts a two-rate B2CS invoice once, not twice", () => {
    const r = buildGstReturn([
      invoice({ lines: [line(500, rupees(1000)), line(1800, rupees(1000))] }),
    ]);
    expect(r.b2cs).toHaveLength(2);
    expect(r.b2cs.every((row) => row.invoices === 1)).toBe(true);
  });
});

describe("totals", () => {
  it("do not double-count the invoice value across rate rows", () => {
    // A B2B row repeats the invoice value per rate; summing the rows would
    // report a two-rate invoice as worth twice what it was.
    const r = buildGstReturn([
      invoice({
        party: withGstin,
        grandTotalPaise: rupees(3300),
        lines: [line(500, rupees(1000)), line(1800, rupees(2000))],
      }),
    ]);
    expect(r.b2b).toHaveLength(2);
    expect(r.totals.invoiceValuePaise).toBe(rupees(3300));
  });

  it("add the tax across both sections", () => {
    const r = buildGstReturn([
      invoice({ party: withGstin }),
      invoice({ number: "B" }),
    ]);
    expect(r.totals.taxableValuePaise).toBe(rupees(2000));
    expect(r.totals.cgstPaise + r.totals.sgstPaise).toBe(rupees(100));
  });
});

describe("the CSV the CA opens", () => {
  it("writes rupees, not paise", () => {
    const r = buildGstReturn([invoice({ party: withGstin })]);
    const csv = b2bCsv(r.b2b);
    expect(csv).toContain("1000.00");
    expect(csv).not.toContain("₹");
  });

  it("writes the rate as a percentage", () => {
    const r = buildGstReturn([invoice({ party: withGstin, lines: [line(250, rupees(400))] })]);
    expect(b2bCsv(r.b2b)).toContain(",2.5,");
  });

  it("writes the date the way the portal wants it", () => {
    const r = buildGstReturn([invoice({ party: withGstin })]);
    expect(b2bCsv(r.b2b)).toContain("04-09-2026");
  });

  it("quotes a name containing a comma rather than breaking the row", () => {
    const r = buildGstReturn([
      invoice({
        party: { name: "x", businessName: "Patel, Sons & Co", gstin: "24AABCA1234B1Z5" },
      }),
    ]);
    const csv = b2bCsv(r.b2b);
    expect(csv).toContain('"Patel, Sons & Co"');
    expect(csv.split("\n")[1].split('"')[2].split(",").length).toBeGreaterThan(1);
  });

  it("marks B2CS rows OE, as the portal expects", () => {
    const r = buildGstReturn([invoice()]);
    expect(b2csCsv(r.b2cs).split("\n")[1]).toMatch(/^OE,24,5,/);
  });
});
