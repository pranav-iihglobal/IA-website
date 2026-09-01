import { describe, expect, it } from "vitest";
import {
  ASSUMED_UQC,
  b2bCsv,
  b2csCsv,
  buildGstReturn,
  buildHsnSummary,
  cdnCsv,
  hsnCsv,
  isB2B,
  type ExportableInvoice,
} from "./gst";

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

describe("the HSN summary (Table 12)", () => {
  const withHsn = (hsn: string, qty: number, taxable: number, bps = 500) => ({
    hsn,
    description: "FloraMax",
    quantity: qty,
    ...line(bps, taxable),
  });

  it("covers ALL supplies, registered and not", () => {
    // Unlike B2B/B2CS, Table 12 does not split by GSTIN — it is one pass over
    // everything, so a summary built from those two sections would be wrong.
    const rows = buildHsnSummary([
      invoice({ party: withGstin, lines: [withHsn("31010099", 5, rupees(1000))] }),
      invoice({ number: "B", lines: [withHsn("31010099", 3, rupees(600))] }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(8);
    expect(rows[0].taxableValuePaise).toBe(rupees(1600));
  });

  it("splits by rate as well as by HSN", () => {
    const rows = buildHsnSummary([
      invoice({
        lines: [withHsn("31010099", 2, rupees(500)), withHsn("31010099", 1, rupees(400), 1800)],
      }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.gstRateBps)).toEqual([500, 1800]);
  });

  it("excludes cancelled invoices, like every other section", () => {
    const rows = buildHsnSummary([
      invoice({ status: "cancelled", lines: [withHsn("31010099", 99, rupees(9000))] }),
    ]);
    expect(rows).toEqual([]);
  });

  it("reports total value as taxable plus tax", () => {
    const rows = buildHsnSummary([
      invoice({ lines: [withHsn("31010099", 1, rupees(1000))] }),
    ]);
    expect(rows[0].taxableValuePaise).toBe(rupees(1000));
    expect(rows[0].totalValuePaise).toBe(rupees(1050));
  });

  it("does not invent an HSN for a line that has none", () => {
    // Reported blank so the gap is visible on the return, rather than filled
    // in with something plausible.
    const rows = buildHsnSummary([
      invoice({ lines: [{ ...line(500, rupees(100)), hsn: "", quantity: 1 }] }),
    ]);
    expect(rows[0].hsn).toBe("");
  });

  it("marks the unit as NOS, which is assumed rather than recorded", () => {
    const rows = buildHsnSummary([
      invoice({ lines: [withHsn("31010099", 1, rupees(100))] }),
    ]);
    expect(rows[0].uqc).toBe(ASSUMED_UQC);
    expect(ASSUMED_UQC).toBe("NOS");
  });

  it("writes a CSV with rupees and a percentage rate", () => {
    const rows = buildHsnSummary([
      invoice({ lines: [withHsn("31010099", 4, rupees(2000))] }),
    ]);
    const csv = hsnCsv(rows);
    expect(csv).toContain("31010099");
    expect(csv).toContain("NOS");
    expect(csv).toContain("2000.00");
    expect(csv).not.toContain("₹");
  });
});

/* -------------------------------------------------------------------------- */
/* Credit notes — CDNR and CDNUR                                              */
/* -------------------------------------------------------------------------- */

/**
 * A credit note is its own section on the return.
 *
 * Putting one in B2B as a negative row would understate that section AND
 * leave the note section empty — two wrong numbers from one mistake, and the
 * portal reconciles the sections separately so both would be visible.
 */

function creditNote(over: Partial<ExportableInvoice> = {}): ExportableInvoice {
  return invoice({
    number: "CN.09.26.001",
    documentType: "credit_note",
    againstNumber: "IA.09.26.001",
    reason: "Short delivery",
    grandTotalPaise: -rupees(1050),
    lines: [
      {
        gstRateBps: 500,
        taxableValuePaise: -rupees(1000),
        cgstPaise: -rupees(25),
        sgstPaise: -rupees(25),
        igstPaise: 0,
      },
    ],
    ...over,
  });
}

describe("credit notes land in their own section", () => {
  it("goes to CDNR when the buyer is registered", () => {
    const r = buildGstReturn([creditNote({ party: withGstin })]);
    expect(r.cdnr).toHaveLength(1);
    expect(r.cdnur).toHaveLength(0);
    expect(r.b2b).toHaveLength(0);
    expect(r.b2cs).toHaveLength(0);
  });

  it("goes to CDNUR when the buyer is not", () => {
    const r = buildGstReturn([creditNote()]);
    expect(r.cdnur).toHaveLength(1);
    expect(r.cdnr).toHaveLength(0);
    expect(r.b2cs).toHaveLength(0);
  });

  it("reports the magnitude, with the note type and the original number", () => {
    // Stored negative so internal sums work; the portal wants it positive.
    const row = buildGstReturn([creditNote({ party: withGstin })]).cdnr[0];
    expect(row.taxableValuePaise).toBe(rupees(1000));
    expect(row.cgstPaise).toBe(rupees(25));
    expect(row.noteValuePaise).toBe(rupees(1050));
    expect(row.noteType).toBe("C");
    expect(row.againstNumber).toBe("IA.09.26.001");
    expect(row.reason).toBe("Short delivery");
  });

  it("is excluded when cancelled, like any other document", () => {
    const r = buildGstReturn([creditNote({ status: "cancelled" })]);
    expect(r.cdnur).toHaveLength(0);
    expect(r.excludedCancelled).toBe(1);
  });
});

describe("credit notes net off the month's liability", () => {
  it("a full credit of the only invoice leaves nothing owed", () => {
    const r = buildGstReturn([invoice({ party: withGstin }), creditNote({ party: withGstin })]);
    expect(r.totals.taxableValuePaise).toBe(0);
    expect(r.totals.cgstPaise).toBe(0);
    expect(r.totals.sgstPaise).toBe(0);
    expect(r.totals.invoiceValuePaise).toBe(0);
    // The supply is still reported. It happened; it was credited afterwards.
    expect(r.b2b).toHaveLength(1);
    expect(r.cdnr).toHaveLength(1);
  });

  it("a partial credit reduces the total rather than removing it", () => {
    const half = creditNote({
      grandTotalPaise: -rupees(525),
      lines: [
        {
          gstRateBps: 500,
          taxableValuePaise: -rupees(500),
          cgstPaise: -rupees(12.5),
          sgstPaise: -rupees(12.5),
          igstPaise: 0,
        },
      ],
    });
    const r = buildGstReturn([invoice(), half]);
    expect(r.totals.taxableValuePaise).toBe(rupees(500));
  });
});

describe("the HSN summary", () => {
  it("nets a credit note off the quantity and the value", () => {
    /*
      Table 12 covers everything, so a credit note belongs in it — and its
      negative quantity is what makes the summary agree with the sections.
    */
    const rows = buildHsnSummary([
      invoice({ lines: [{ ...line(500, rupees(1000)), hsn: "31010099", description: "FloraMax", quantity: 10 }] }),
      creditNote({
        lines: [
          {
            gstRateBps: 500,
            hsn: "31010099",
            description: "FloraMax",
            quantity: -4,
            taxableValuePaise: -rupees(400),
            cgstPaise: -rupees(10),
            sgstPaise: -rupees(10),
            igstPaise: 0,
          },
        ],
      }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(6);
    expect(rows[0].taxableValuePaise).toBe(rupees(600));
  });
});

describe("the CDN csv", () => {
  it("names the buyer when registered and says B2CS when not", () => {
    const r = buildGstReturn([creditNote({ party: withGstin }), creditNote({ number: "CN.09.26.002" })]);
    const registered = cdnCsv(r.cdnr, true);
    expect(registered.split("\n")[0]).toContain("GSTIN/UIN of Recipient");
    expect(registered).toContain("24AABCA1234B1Z5");

    const unregistered = cdnCsv(r.cdnur, false);
    expect(unregistered.split("\n")[0]).toContain("UR Type");
    expect(unregistered).toContain("B2CS");
  });

  it("writes rupees, the original number and the reason", () => {
    const row = cdnCsv(buildGstReturn([creditNote()]).cdnur, false).split("\n")[1];
    expect(row).toContain("1050.00");
    expect(row).toContain("IA.09.26.001");
    expect(row).toContain("Short delivery");
  });
});
