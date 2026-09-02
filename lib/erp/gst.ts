import { paiseToRupeeString } from "@/lib/money";
import { formatIstDate } from "@/lib/time";
import { PORTAL_CSV, toCsv as writeCsv } from "@/lib/csv";
import type { SupplyType } from "./tax";

/**
 * The GSTR-1 export the CA files from.
 *
 * Two sections, because GSTR-1 wants two:
 *
 *   B2B   — every sale to a party WITH a GSTIN, listed individually. The
 *           buyer claims input credit against these, so each one has to
 *           appear with its own invoice number.
 *   B2CS  — sales to unregistered buyers, which are NOT listed individually.
 *           They are summarised per place of supply and per rate, because
 *           nobody is claiming credit and the department only wants the
 *           totals.
 *
 * **A GSTIN is what decides which section a sale lands in** — not the customer
 * record's channel, not whether we call them a dealer. A dealer who has not
 * given us a GSTIN is a B2C sale on the return, and getting that backwards is
 * a filing error rather than a display one.
 *
 * PLACE OF SUPPLY IS A STATE CODE. Their existing GST_Filing_Export carries a
 * PIN in this column (363310 where 24 was meant), which is worth raising with
 * the CA.
 *
 * Cancelled invoices are excluded entirely. A cancelled invoice is not a
 * supply, and reporting one would overstate the liability.
 */

export interface ExportableInvoice {
  number: string;
  documentType?: "invoice" | "credit_note";
  againstNumber?: string;
  reason?: string;
  issuedAt: string | null;
  status: string;
  placeOfSupplyStateCode: string;
  supplyType: SupplyType;
  party: { name: string; businessName: string; gstin: string };
  grandTotalPaise: number;
  lines: {
    /** Blank on a line whose product had none. Reported as such, not guessed. */
    hsn?: string;
    description?: string;
    quantity?: number;
    gstRateBps: number;
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
  }[];
}

export interface B2BRow {
  gstin: string;
  party: string;
  invoiceNo: string;
  invoiceDate: string;
  invoiceValuePaise: number;
  placeOfSupply: string;
  reverseCharge: "N";
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

export interface B2CSRow {
  placeOfSupply: string;
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  /** How many invoices rolled into this row, so a total can be reconciled. */
  invoices: number;
}

/**
 * A credit or debit note. CDNR when the buyer is registered, CDNUR when not.
 *
 * Reported POSITIVE on the return with a note type, which is what the portal
 * expects — even though they are stored negative so every internal sum works
 * without a special case.
 */
export interface CdnRow {
  gstin: string;
  party: string;
  noteNo: string;
  noteDate: string;
  noteType: "C";
  againstNumber: string;
  reason: string;
  placeOfSupply: string;
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  noteValuePaise: number;
}

export interface GstReturn {
  b2b: B2BRow[];
  b2cs: B2CSRow[];
  /** Credit notes to registered buyers. */
  cdnr: CdnRow[];
  /** Credit notes to unregistered buyers. */
  cdnur: CdnRow[];
  totals: {
    taxableValuePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    invoiceValuePaise: number;
  };
  excludedCancelled: number;
}

/** A sale is B2B if, and only if, the buyer gave us a GSTIN. */
export function isB2B(invoice: ExportableInvoice): boolean {
  return Boolean(invoice.party?.gstin?.trim());
}

/**
 * dd-mm-yyyy, which is what the GST portal expects — and the IST day.
 *
 * This is the date the CA files against each invoice, so reading it off the
 * server's UTC clock put a day-early date on the return for anything raised
 * before 05:30 IST.
 */
function isoDate(value: string | null): string {
  if (!value) return "";
  return formatIstDate(new Date(value));
}

export function buildGstReturn(invoices: ExportableInvoice[]): GstReturn {
  const live = invoices.filter((i) => i.status !== "cancelled");

  const b2b: B2BRow[] = [];
  const b2csMap = new Map<string, B2CSRow>();
  const b2csInvoices = new Map<string, Set<string>>();
  const cdnr: CdnRow[] = [];
  const cdnur: CdnRow[] = [];

  for (const invoice of live) {
    /*
      One row per RATE, not per invoice. An invoice mixing 5% and 18% is two
      lines on the return — the portal reconciles rate by rate, so collapsing
      them into one row with a blended rate would not file.
    */
    const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
    for (const line of invoice.lines ?? []) {
      const row = byRate.get(line.gstRateBps) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      row.taxable += line.taxableValuePaise ?? 0;
      row.cgst += line.cgstPaise ?? 0;
      row.sgst += line.sgstPaise ?? 0;
      row.igst += line.igstPaise ?? 0;
      byRate.set(line.gstRateBps, row);
    }

    for (const [gstRateBps, sums] of [...byRate.entries()].sort((a, b) => a[0] - b[0])) {
      /*
        A credit note belongs in CDNR/CDNUR, never in B2B or B2CS. Putting one
        in B2B as a negative row would understate that section AND leave the
        note section empty — two wrong numbers from one mistake.

        Values are flipped positive here: they are stored negative so every
        internal sum works without a special case, and the portal wants the
        magnitude with a note type beside it.
      */
      if (invoice.documentType === "credit_note") {
        const row: CdnRow = {
          gstin: invoice.party.gstin.trim().toUpperCase(),
          party: invoice.party.businessName || invoice.party.name,
          noteNo: invoice.number,
          noteDate: isoDate(invoice.issuedAt),
          noteType: "C",
          againstNumber: invoice.againstNumber ?? "",
          reason: invoice.reason ?? "",
          placeOfSupply: invoice.placeOfSupplyStateCode,
          gstRateBps,
          taxableValuePaise: Math.abs(sums.taxable),
          cgstPaise: Math.abs(sums.cgst),
          sgstPaise: Math.abs(sums.sgst),
          igstPaise: Math.abs(sums.igst),
          noteValuePaise: Math.abs(invoice.grandTotalPaise),
        };
        (isB2B(invoice) ? cdnr : cdnur).push(row);
        continue;
      }

      if (isB2B(invoice)) {
        b2b.push({
          gstin: invoice.party.gstin.trim().toUpperCase(),
          party: invoice.party.businessName || invoice.party.name,
          invoiceNo: invoice.number,
          invoiceDate: isoDate(invoice.issuedAt),
          invoiceValuePaise: invoice.grandTotalPaise,
          placeOfSupply: invoice.placeOfSupplyStateCode,
          reverseCharge: "N",
          gstRateBps,
          taxableValuePaise: sums.taxable,
          cgstPaise: sums.cgst,
          sgstPaise: sums.sgst,
          igstPaise: sums.igst,
        });
      } else {
        const key = `${invoice.placeOfSupplyStateCode}:${gstRateBps}`;
        const row = b2csMap.get(key) ?? {
          placeOfSupply: invoice.placeOfSupplyStateCode,
          gstRateBps,
          taxableValuePaise: 0,
          cgstPaise: 0,
          sgstPaise: 0,
          igstPaise: 0,
          invoices: 0,
        };
        row.taxableValuePaise += sums.taxable;
        row.cgstPaise += sums.cgst;
        row.sgstPaise += sums.sgst;
        row.igstPaise += sums.igst;
        b2csMap.set(key, row);

        // Counted by invoice, not by rate row, or a two-rate invoice counts twice.
        const seen = b2csInvoices.get(key) ?? new Set<string>();
        seen.add(invoice.number);
        b2csInvoices.set(key, seen);
      }
    }
  }

  for (const [key, row] of b2csMap) {
    row.invoices = b2csInvoices.get(key)?.size ?? 0;
  }

  const b2cs = [...b2csMap.values()].sort(
    (a, b) =>
      a.placeOfSupply.localeCompare(b.placeOfSupply) || a.gstRateBps - b.gstRateBps,
  );

  const supplies = [...b2b, ...b2cs];
  const notes = [...cdnr, ...cdnur];
  /*
    Credit notes SUBTRACT from the totals. They are held positive in their rows
    because the portal wants magnitudes, so the sign has to come back here —
    the liability for the month is supplies less credits.
  */
  const net = (pick: (r: { taxableValuePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }) => number) =>
    supplies.reduce((t, r) => t + pick(r), 0) - notes.reduce((t, r) => t + pick(r), 0);

  return {
    b2b,
    b2cs,
    cdnr,
    cdnur,
    totals: {
      taxableValuePaise: net((r) => r.taxableValuePaise),
      cgstPaise: net((r) => r.cgstPaise),
      sgstPaise: net((r) => r.sgstPaise),
      igstPaise: net((r) => r.igstPaise),
      // B2B rows repeat the invoice value per rate, so it is summed from the
      // invoices themselves rather than from the rows.
      invoiceValuePaise: live.reduce((t, i) => t + (i.grandTotalPaise ?? 0), 0),
    },
    excludedCancelled: invoices.length - live.length,
  };
}

/** Percentage as the portal writes it: 5, 18, 2.5. */
function rate(bps: number): string {
  return String(bps / 100);
}

/**
 * The portal's bytes, exactly as filed before: LF, no BOM, nothing
 * rewritten. The quoting itself now lives in lib/csv.ts with the list
 * exports, which need a different reader in mind — see there.
 */
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return writeCsv(headers, rows, PORTAL_CSV);
}

/**
 * The two sheets, as CSV.
 *
 * Rupees here, not paise — this is read by a person and pasted into a portal
 * that expects rupees. It is the boundary, and `paiseToRupeeString` is the
 * only thing that crosses it, producing a plain "1234.56" with no symbol and
 * no grouping because a spreadsheet must be able to parse it back.
 */
export function b2bCsv(rows: B2BRow[]): string {
  return toCsv(
    [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Invoice Number",
      "Invoice date",
      "Invoice Value",
      "Place Of Supply",
      "Reverse Charge",
      "Rate",
      "Taxable Value",
      "Cess Amount",
    ],
    rows.map((r) => [
      r.gstin,
      r.party,
      r.invoiceNo,
      r.invoiceDate,
      paiseToRupeeString(r.invoiceValuePaise),
      r.placeOfSupply,
      r.reverseCharge,
      rate(r.gstRateBps),
      paiseToRupeeString(r.taxableValuePaise),
      "0",
    ]),
  );
}

export function b2csCsv(rows: B2CSRow[]): string {
  return toCsv(
    ["Type", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount"],
    rows.map((r) => [
      "OE",
      r.placeOfSupply,
      rate(r.gstRateBps),
      paiseToRupeeString(r.taxableValuePaise),
      "0",
    ]),
  );
}

/* -------------------------------------------------------------------------- */
/* Table 12 — the HSN-wise summary                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every supply rolled up by HSN and rate.
 *
 * GSTR-1 asks for this separately from B2B and B2CS, and unlike those two it
 * covers **all** supplies together — registered and unregistered alike. So it
 * is not derived from the other two sections; it is its own pass over the
 * same invoices.
 *
 * UQC is the unit-of-quantity code the portal expects, from a fixed list
 * (NOS, KGS, GMS, BOX…). Invoice lines do not carry one: nothing in this
 * business is sold by weight — sachets and canisters are counted — so `NOS`
 * is right for all three SKUs. It is **assumed rather than recorded**, and the
 * screen says so, because assuming quietly on a filing is how a wrong return
 * gets signed. If the CA wants something else it becomes a product field.
 */
export const ASSUMED_UQC = "NOS";

export interface HsnRow {
  hsn: string;
  description: string;
  uqc: string;
  quantity: number;
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalValuePaise: number;
}

export function buildHsnSummary(invoices: ExportableInvoice[]): HsnRow[] {
  const rows = new Map<string, HsnRow>();

  for (const invoice of invoices) {
    // Same exclusion as the rest of the return: a cancellation is not a supply.
    if (invoice.status === "cancelled") continue;

    for (const line of invoice.lines ?? []) {
      const hsn = (line.hsn ?? "").trim();
      const key = `${hsn}:${line.gstRateBps}`;
      const row = rows.get(key) ?? {
        hsn,
        description: line.description ?? "",
        uqc: ASSUMED_UQC,
        quantity: 0,
        gstRateBps: line.gstRateBps,
        taxableValuePaise: 0,
        cgstPaise: 0,
        sgstPaise: 0,
        igstPaise: 0,
        totalValuePaise: 0,
      };

      const tax =
        (line.cgstPaise ?? 0) + (line.sgstPaise ?? 0) + (line.igstPaise ?? 0);
      row.quantity += line.quantity ?? 0;
      row.taxableValuePaise += line.taxableValuePaise ?? 0;
      row.cgstPaise += line.cgstPaise ?? 0;
      row.sgstPaise += line.sgstPaise ?? 0;
      row.igstPaise += line.igstPaise ?? 0;
      row.totalValuePaise += (line.taxableValuePaise ?? 0) + tax;
      rows.set(key, row);
    }
  }

  return [...rows.values()].sort(
    (a, b) => a.hsn.localeCompare(b.hsn) || a.gstRateBps - b.gstRateBps,
  );
}

export function hsnCsv(rows: HsnRow[]): string {
  return toCsv(
    [
      "HSN",
      "Description",
      "UQC",
      "Total Quantity",
      "Rate",
      "Total Value",
      "Taxable Value",
      "Integrated Tax Amount",
      "Central Tax Amount",
      "State/UT Tax Amount",
      "Cess Amount",
    ],
    rows.map((r) => [
      r.hsn,
      r.description,
      r.uqc,
      r.quantity,
      rate(r.gstRateBps),
      paiseToRupeeString(r.totalValuePaise),
      paiseToRupeeString(r.taxableValuePaise),
      paiseToRupeeString(r.igstPaise),
      paiseToRupeeString(r.cgstPaise),
      paiseToRupeeString(r.sgstPaise),
      "0",
    ]),
  );
}

/** CDNR and CDNUR share a shape; the section differs by whether there is a GSTIN. */
export function cdnCsv(rows: CdnRow[], registered: boolean): string {
  const head = registered
    ? ["GSTIN/UIN of Recipient", "Receiver Name"]
    : ["UR Type"];
  return toCsv(
    [
      ...head,
      "Note/Refund Voucher Number",
      "Note/Refund Voucher date",
      "Invoice/Advance Payment Voucher number",
      "Note/Refund Voucher Value",
      "Place Of Supply",
      "Note Type",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "Reason For Issuing document",
    ],
    rows.map((r) => [
      ...(registered ? [r.gstin, r.party] : ["B2CS"]),
      r.noteNo,
      r.noteDate,
      r.againstNumber,
      paiseToRupeeString(r.noteValuePaise),
      r.placeOfSupply,
      r.noteType,
      rate(r.gstRateBps),
      paiseToRupeeString(r.taxableValuePaise),
      "0",
      r.reason,
    ]),
  );
}
