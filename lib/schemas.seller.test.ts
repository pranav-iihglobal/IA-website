import { describe, expect, it } from "vitest";
import { sellerSchema } from "./schemas";
import { fieldErrors } from "./admin/field-errors";

/**
 * The rules on the Settings page, which is the one form in the panel whose
 * output is printed on every legal document the company issues.
 */

const bank = {
  accountName: "IKSARVA AGRITECH PRIVATE LIMITED",
  name: "HDFC Bank",
  accountNo: "50200097910552",
  ifsc: "HDFC0009254",
  upi: "iksarva.agritech@okhdfcbank",
};

function errorsOf(input: unknown): Record<string, string> {
  const parsed = sellerSchema.safeParse(input);
  return parsed.success ? {} : fieldErrors(parsed.error.issues);
}

describe("the GSTIN", () => {
  it("is required — without it the document is not a tax invoice", () => {
    expect(errorsOf({ gstin: "", bank }).gstin).toMatch(/needs the seller/);
  });

  it("must be a real GSTIN", () => {
    expect(errorsOf({ gstin: "24AAHCI7997Q1Z", bank }).gstin).toMatch(/not a valid GSTIN/);
  });

  it("must be registered in the state the tax engine calls home", () => {
    // 27 is Maharashtra. Every invoice would charge IGST where CGST+SGST
    // was due, and nothing else in the system would notice.
    expect(errorsOf({ gstin: "27AAHCI7997Q1ZG", bank }).gstin).toMatch(/Gujarat/);
  });

  it("is uppercased rather than refused", () => {
    const parsed = sellerSchema.safeParse({ gstin: "24aahci7997q1zg", bank });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.gstin).toBe("24AAHCI7997Q1ZG");
  });
});

describe("the bank block", () => {
  it("accepts all four filled in", () => {
    expect(errorsOf({ gstin: "24AAHCI7997Q1ZG", bank })).toEqual({});
  });

  it("accepts all four blank — nothing is printed", () => {
    const blank = { accountName: "", name: "", accountNo: "", ifsc: "", upi: "" };
    expect(errorsOf({ gstin: "24AAHCI7997Q1ZG", bank: blank })).toEqual({});
  });

  it("refuses a half-filled block, naming each missing field", () => {
    // An account number with no IFSC looks payable and is not.
    const errors = errorsOf({ gstin: "24AAHCI7997Q1ZG", bank: { ...bank, ifsc: "", name: "" } });
    expect(errors["bank.ifsc"]).toMatch(/all four/);
    expect(errors["bank.name"]).toMatch(/all four/);
    expect(errors["bank.accountNo"]).toBeUndefined();
  });

  it("checks the IFSC's shape — a wrong one sends money nowhere", () => {
    expect(errorsOf({ gstin: "24AAHCI7997Q1ZG", bank: { ...bank, ifsc: "HDFC9254" } })["bank.ifsc"]).toMatch(
      /IFSC/,
    );
  });

  it("checks the UPI id is one, not an email address", () => {
    expect(
      errorsOf({ gstin: "24AAHCI7997Q1ZG", bank: { ...bank, upi: "pay@iksarva.com" } })["bank.upi"],
    ).toMatch(/UPI/);
  });

  it("normalises the casing the way the documents print it", () => {
    const parsed = sellerSchema.safeParse({
      gstin: "24AAHCI7997Q1ZG",
      bank: { ...bank, ifsc: "hdfc0009254", upi: "Iksarva.Agritech@OKHDFCBANK" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bank.ifsc).toBe("HDFC0009254");
      expect(parsed.data.bank.upi).toBe("iksarva.agritech@okhdfcbank");
    }
  });
});
