import { paiseToRupeeString } from "@/lib/money";
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
  issuedAt: string | null;
  status: string;
  placeOfSupplyStateCode: string;
  supplyType: SupplyType;
  party: { name: string; businessName: string; gstin: string };
  grandTotalPaise: number;
  lines: {
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

export interface GstReturn {
  b2b: B2BRow[];
  b2cs: B2CSRow[];
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

function isoDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  // dd-mm-yyyy, which is what the GST portal expects.
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export function buildGstReturn(invoices: ExportableInvoice[]): GstReturn {
  const live = invoices.filter((i) => i.status !== "cancelled");

  const b2b: B2BRow[] = [];
  const b2csMap = new Map<string, B2CSRow>();
  const b2csInvoices = new Map<string, Set<string>>();

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

  const all = [...b2b, ...b2cs];
  return {
    b2b,
    b2cs,
    totals: {
      taxableValuePaise: all.reduce((t, r) => t + r.taxableValuePaise, 0),
      cgstPaise: all.reduce((t, r) => t + r.cgstPaise, 0),
      sgstPaise: all.reduce((t, r) => t + r.sgstPaise, 0),
      igstPaise: all.reduce((t, r) => t + r.igstPaise, 0),
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

/** One CSV cell, quoted only when it has to be. */
function cell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\n");
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
