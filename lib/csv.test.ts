import { describe, expect, it } from "vitest";
import { PORTAL_CSV, SPREADSHEET_CSV, csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves a plain value alone", () => {
    expect(csvCell("Kherva")).toBe("Kherva");
    expect(csvCell(1234.5)).toBe("1234.5");
  });

  it("quotes a comma, a quote or a line break, doubling quotes", () => {
    expect(csvCell("Patel, Sons & Co")).toBe('"Patel, Sons & Co"');
    expect(csvCell('the "big" one')).toBe('"the ""big"" one"');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
    expect(csvCell("cr\rlf")).toBe('"cr\rlf"');
  });

  it("neutralises a cell a spreadsheet would run as a formula", () => {
    // Prefixed, then quoted because of the quotes inside it.
    expect(csvCell('=HYPERLINK("x")', true)).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+91 98250", true)).toBe("'+91 98250");
    expect(csvCell("@everyone", true)).toBe("'@everyone");
    expect(csvCell("-Patel", true)).toBe("'-Patel");
  });

  it("does NOT touch a negative number — a credit note is money, not a formula", () => {
    expect(csvCell("-1050.00", true)).toBe("-1050.00");
    expect(csvCell(-12, true)).toBe("-12");
  });

  it("guards nothing unless asked — the portal file must not change", () => {
    expect(csvCell("+91", false)).toBe("+91");
  });
});

describe("toCsv", () => {
  const headers = ["Name", "Amount"];
  const rows: (string | number)[][] = [["Patel", "1234.56"], ["Shah, Co", -5]];

  it("writes a spreadsheet file with a BOM and CRLF", () => {
    const csv = toCsv(headers, rows, SPREADSHEET_CSV);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('Name,Amount\r\nPatel,1234.56\r\n"Shah, Co",-5');
  });

  it("writes the portal file exactly as before: no BOM, LF, nothing guarded", () => {
    const csv = toCsv(["a"], [["+1"]], PORTAL_CSV);
    expect(csv).toBe("a\n+1");
  });

  it("defaults to the spreadsheet form", () => {
    expect(toCsv(["a"], [["b"]]).startsWith("﻿")).toBe(true);
  });
});
