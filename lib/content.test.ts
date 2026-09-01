import { describe, expect, it } from "vitest";
import { SELLER, SITE } from "./content";
import { GUJARAT_STATE_CODE } from "./erp/tax";

/**
 * IKSARVA's own tax identity, checked rather than trusted.
 *
 * These are four short strings in a config file, which is exactly why they get
 * assertions: they are edited by hand, rarely, by someone who will not be
 * thinking about the tax engine — and one wrong character produces a wrong
 * legal document rather than a crash.
 */

/**
 * State code (2 digits), PAN (5 letters, 4 digits, 1 letter), entity number,
 * "Z", checksum.
 */
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/;
const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;

describe("SELLER", () => {
  it("has a GSTIN of the right shape", () => {
    // Without one, the print view refuses to call itself a tax invoice.
    expect(SELLER.gstin).toMatch(GSTIN);
  });

  it("has a PAN of the right shape", () => {
    expect(SELLER.pan).toMatch(PAN);
  });

  it("has a GSTIN that embeds the PAN, because it must", () => {
    // Characters 3–12 of a GSTIN ARE the PAN. If these two were typed from
    // different documents and disagree, one of them is wrong.
    expect(SELLER.gstin.slice(2, 12)).toBe(SELLER.pan);
  });

  it("has a state code that matches the GSTIN", () => {
    expect(SELLER.gstin.slice(0, 2)).toBe(SELLER.stateCode);
  });

  /**
   * The one worth having.
   *
   * supplyTypeFor() compares the place of supply against GUJARAT_STATE_CODE to
   * decide CGST+SGST versus IGST. If that constant and our own GSTIN ever
   * disagree, every invoice charges the wrong kind of tax — and nothing else
   * in the system would notice, because both answers are well-formed.
   */
  it("is registered in the state the tax engine treats as home", () => {
    expect(SELLER.gstin.slice(0, 2)).toBe(GUJARAT_STATE_CODE);
  });
});

describe("the registered address", () => {
  it("matches the GST certificate", () => {
    // An invoice whose address does not match the registration is the kind of
    // mismatch a filing gets queried on.
    expect(SITE.address.district).toBe("Aravalli");
    expect(SITE.address.postalCode).toBe("383250");
    expect(SITE.address.state).toBe("Gujarat");
  });
});

describe("bank details", () => {
  it("has an IFSC of the right shape", () => {
    // 4 letters, "0", then 6 alphanumerics. A wrong one sends money nowhere.
    expect(SELLER.bank.ifsc).toMatch(/^[A-Z]{4}0[A-Z\d]{6}$/);
  });

  it("has a UPI id, not an email address", () => {
    expect(SELLER.bank.upi).toMatch(/^[\w.\-]{3,}@[a-z]{3,}$/);
  });

  it("is either fully filled in or fully blank", () => {
    // A half-filled block prints an account number with no IFSC, which is
    // worse than printing nothing: it looks payable and is not.
    const filled = [
      SELLER.bank.accountName,
      SELLER.bank.name,
      SELLER.bank.accountNo,
      SELLER.bank.ifsc,
    ].filter(Boolean).length;
    expect([0, 4]).toContain(filled);
  });
});
