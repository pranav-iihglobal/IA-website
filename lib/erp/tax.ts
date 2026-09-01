import { amountInWords, roundHalfAwayFromZero } from "@/lib/money";

/**
 * The GST arithmetic on an invoice.
 *
 * A pure function with exactly one right answer, deliberately knowing nothing
 * about the database, the PDF or the screen. Everything financial that this
 * app is trusted with reduces to this file, so it is the one place worth
 * testing exhaustively — and the whole reason a test runner went in before any
 * invoice code did.
 *
 * The requirements it exists to satisfy, all of them statutory rather than
 * stylistic:
 *
 *   1. CGST and SGST are shown SEPARATELY on an intra-state invoice. A single
 *      combined "CGST, SGST 5%" line is not a compliant tax invoice.
 *   2. Inter-state is IGST instead — never all three.
 *   3. The grand total, the sum of the lines and the figure in words are the
 *      same number. One computation, one rounding point.
 *   4. Rounding to the whole rupee is shown as its OWN LINE, not absorbed. A
 *      difference that silently disappears between the computed total and the
 *      printed one is how a set of books stops tying.
 *
 * Rates are BASIS POINTS, not percentages: 500 = 5%, 1800 = 18%, 250 = 2.5%.
 * GST has half-percent rates, so a percentage would have to be a float, and a
 * float is the thing this whole layer exists to keep out.
 */

/** 5% = 500bp. The divisor for applying one. */
const BPS_DIVISOR = 10_000;

/** Intra-state tax splits in two equal halves; inter-state does not split. */
export type SupplyType = "intra" | "inter";

export interface InvoiceLineInput {
  /** What was sold. Carried through untouched — this file does not price. */
  description: string;
  /** HSN code. From the product record, never typed onto a line. */
  hsn: string;
  quantity: number;
  /** Price for ONE unit, in paise, before tax. */
  unitPricePaise: number;
  /** Discount on this line in paise, subtracted before tax. */
  discountPaise?: number;
  /** GST rate in basis points, from the product record. 500 = 5%. */
  gstRateBps: number;
}

export interface TaxedLine extends InvoiceLineInput {
  /** quantity × unit price, less any discount. The value GST applies to. */
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  /** taxable + whichever taxes apply. */
  lineTotalPaise: number;
}

export interface TaxedInvoice {
  lines: TaxedLine[];
  supplyType: SupplyType;
  /** Sum of the taxable values. The "Taxable Value" total on the invoice. */
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  /** Before rounding to the rupee. */
  grossPaise: number;
  /** Shown as its own line. Between -50 and +49 paise, and often 0. */
  roundOffPaise: number;
  /** What is actually payable. Always a whole number of rupees. */
  grandTotalPaise: number;
  /** Derived from grandTotalPaise, so the two cannot disagree. */
  amountInWords: string;
  /**
   * Per rate, for the GST summary table an invoice carries and for GSTR-1.
   * Keyed by basis points, ascending.
   */
  byRate: RateSummary[];
}

export interface RateSummary {
  gstRateBps: number;
  taxableValuePaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

/**
 * Tax on one line, rounded to the paise once.
 *
 * Rounded PER LINE rather than once on the invoice total, because that is what
 * the rate-wise summary table on the invoice has to add up to. Round only at
 * the end and the summary disagrees with the lines by a paisa or two, which is
 * precisely the discrepancy a filing gets queried on.
 */
function taxOnLine(taxableValuePaise: number, gstRateBps: number): number {
  return roundHalfAwayFromZero((taxableValuePaise * gstRateBps) / BPS_DIVISOR);
}

/**
 * Split a line's tax into CGST and SGST.
 *
 * An odd number of paise cannot halve evenly. The half-paisa goes to SGST, by
 * the arbitrary-but-fixed rule that CGST takes the floor — what matters is
 * only that the two halves add back to exactly the tax, every time, so no
 * invoice ever gains or loses a paisa to a split.
 */
function splitHalves(taxPaise: number): { cgst: number; sgst: number } {
  const cgst = Math.trunc(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst };
}

export function computeInvoice(
  input: InvoiceLineInput[],
  supplyType: SupplyType,
): TaxedInvoice {
  const lines: TaxedLine[] = input.map((line) => {
    const taxableValuePaise =
      line.quantity * line.unitPricePaise - (line.discountPaise ?? 0);
    const tax = taxOnLine(taxableValuePaise, line.gstRateBps);

    const { cgst, sgst } =
      supplyType === "intra" ? splitHalves(tax) : { cgst: 0, sgst: 0 };
    const igst = supplyType === "inter" ? tax : 0;

    return {
      ...line,
      taxableValuePaise,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      lineTotalPaise: taxableValuePaise + cgst + sgst + igst,
    };
  });

  const sum = (pick: (l: TaxedLine) => number) =>
    lines.reduce((total, line) => total + pick(line), 0);

  const subtotalPaise = sum((l) => l.taxableValuePaise);
  const cgstPaise = sum((l) => l.cgstPaise);
  const sgstPaise = sum((l) => l.sgstPaise);
  const igstPaise = sum((l) => l.igstPaise);
  const totalTaxPaise = cgstPaise + sgstPaise + igstPaise;

  const grossPaise = subtotalPaise + totalTaxPaise;
  // To the nearest whole rupee, as Indian invoices are settled.
  const grandTotalPaise = roundHalfAwayFromZero(grossPaise / 100) * 100;
  const roundOffPaise = grandTotalPaise - grossPaise;

  return {
    lines,
    supplyType,
    subtotalPaise,
    cgstPaise,
    sgstPaise,
    igstPaise,
    totalTaxPaise,
    grossPaise,
    roundOffPaise,
    grandTotalPaise,
    amountInWords: amountInWords(grandTotalPaise),
    byRate: summariseByRate(lines),
  };
}

/** The rate-wise table: one row per GST rate appearing on the invoice. */
function summariseByRate(lines: TaxedLine[]): RateSummary[] {
  const rows = new Map<number, RateSummary>();

  for (const line of lines) {
    const row = rows.get(line.gstRateBps) ?? {
      gstRateBps: line.gstRateBps,
      taxableValuePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    };
    row.taxableValuePaise += line.taxableValuePaise;
    row.cgstPaise += line.cgstPaise;
    row.sgstPaise += line.sgstPaise;
    row.igstPaise += line.igstPaise;
    rows.set(line.gstRateBps, row);
  }

  return [...rows.values()].sort((a, b) => a.gstRateBps - b.gstRateBps);
}

/** "5%", "2.5%" — for the invoice and the summary table. */
export function formatRate(gstRateBps: number): string {
  const percent = gstRateBps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, "")}%`;
}

/**
 * Which tax applies, from the two states involved.
 *
 * Place of supply is a STATE, not a PIN code. Their existing GST_Filing_Export
 * carries a pin (e.g. 363310) where GSTR-1 expects the state code — 24 for
 * Gujarat. Codes rather than names, because a name has spellings and a code
 * does not.
 */
export function supplyTypeFor(
  sellerStateCode: string,
  placeOfSupplyStateCode: string,
): SupplyType {
  return sellerStateCode === placeOfSupplyStateCode ? "intra" : "inter";
}

/** IKSARVA is in Gujarat. Every intra-state sale is a Gujarat-to-Gujarat one. */
export const GUJARAT_STATE_CODE = "24";
