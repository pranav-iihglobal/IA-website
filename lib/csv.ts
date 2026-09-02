/**
 * CSV, written once.
 *
 * Lifted out of lib/erp/gst.ts, where it was private and served only the
 * GSTR-1 sheets. Every list in the panel can be exported now, and the two
 * kinds of file have different readers:
 *
 *   The GST sheets go into the portal's offline tool. ASCII, LF, no BOM —
 *   exactly what was filed before, and nothing here changes a byte of it.
 *
 *   A list export is opened by a person in Excel or Sheets. Excel on Windows
 *   reads a CSV as the machine's code page unless it starts with a BOM, so
 *   ગુજરાતી names arrive as question marks without one. And a cell that
 *   starts with = + - or @ is executed as a formula by both — which makes a
 *   customer named "=HYPERLINK(...)" a real hazard in a file somebody was
 *   asked to open. Those cells are prefixed with an apostrophe, the
 *   convention both programs understand as "text, not formula". A plain
 *   number is left alone, so "-12.50" stays a number.
 *
 * RFC 4180 quoting throughout: a cell is quoted only when it has to be, and
 * a quote inside it is doubled.
 */

export interface CsvOptions {
  /** Prefix U+FEFF so Excel reads the file as UTF-8. */
  bom?: boolean;
  /** "\r\n" for a file a person opens; "\n" for the portal. */
  newline?: "\r\n" | "\n";
  /** Neutralise cells that would run as a formula in a spreadsheet. */
  guardFormulas?: boolean;
}

/** What a person opens: BOM, CRLF, formulas neutralised. */
export const SPREADSHEET_CSV: Required<CsvOptions> = {
  bom: true,
  newline: "\r\n",
  guardFormulas: true,
};

/** What the portal's offline tool reads: bytes exactly as before. */
export const PORTAL_CSV: Required<CsvOptions> = {
  bom: false,
  newline: "\n",
  guardFormulas: false,
};

/** Rows an export stops at. Beyond this the file says so on its last line. */
export const EXPORT_CAP = 10_000;

const NUMBER = /^-?\d+(\.\d+)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell, quoted only when it has to be. */
export function csvCell(value: string | number, guardFormulas = false): string {
  let text = String(value);
  if (guardFormulas && FORMULA_START.test(text) && !NUMBER.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: string[],
  rows: (string | number)[][],
  options: CsvOptions = SPREADSHEET_CSV,
): string {
  const { bom, newline, guardFormulas } = { ...SPREADSHEET_CSV, ...options };
  const body = [headers, ...rows]
    .map((row) => row.map((v) => csvCell(v, guardFormulas)).join(","))
    .join(newline);
  return (bom ? "﻿" : "") + body;
}
