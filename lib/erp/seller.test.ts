import { describe, expect, it } from "vitest";
import { SELLER } from "@/lib/content";
import {
  DEFAULT_SELLER,
  deriveSeller,
  sellerAuditShape,
  sellerFrom,
} from "./seller";

const bank = {
  accountName: "IKSARVA AGRITECH PRIVATE LIMITED",
  name: "HDFC Bank",
  accountNo: "50200097910552",
  ifsc: "hdfc0009254",
  upi: "Iksarva.Agritech@okhdfcbank",
};

describe("deriveSeller", () => {
  it("reads the PAN and the state off the GSTIN rather than asking for them", () => {
    const seller = deriveSeller({ gstin: "24AAHCI7997Q1ZG", bank });
    expect(seller.pan).toBe("AAHCI7997Q");
    expect(seller.stateCode).toBe("24");
  });

  it("normalises casing the way the documents print it", () => {
    const seller = deriveSeller({ gstin: " 24aahci7997q1zg ", bank });
    expect(seller.gstin).toBe("24AAHCI7997Q1ZG");
    expect(seller.bank.ifsc).toBe("HDFC0009254");
    expect(seller.bank.upi).toBe("iksarva.agritech@okhdfcbank");
  });

  it("derives nothing from a GSTIN of the wrong length", () => {
    // The schema refuses it; this just must not slice garbage into a PAN.
    const seller = deriveSeller({ gstin: "24AAH", bank });
    expect(seller.pan).toBe("");
    expect(seller.stateCode).toBe("24");
  });
});

describe("the fallback", () => {
  it("is the constant the invoices were printed from before this existed", () => {
    expect(DEFAULT_SELLER.gstin).toBe(SELLER.gstin);
    expect(DEFAULT_SELLER.pan).toBe(SELLER.pan);
    expect(DEFAULT_SELLER.stateCode).toBe(SELLER.stateCode);
    expect(DEFAULT_SELLER.bank).toEqual(SELLER.bank);
  });

  it("is what an invoice without a snapshot says", () => {
    expect(sellerFrom(null)).toBe(DEFAULT_SELLER);
    expect(sellerFrom(undefined)).toBe(DEFAULT_SELLER);
  });

  it("is NOT what an invoice with a snapshot says", () => {
    // A bank account changed in October must not appear on a September
    // invoice reprinted in November.
    const snapshot = sellerFrom({
      gstin: "24AAHCI7997Q1ZG",
      pan: "AAHCI7997Q",
      stateCode: "24",
      bank: { ...bank, accountNo: "OLD-ACCOUNT" },
    });
    expect(snapshot.bank.accountNo).toBe("OLD-ACCOUNT");
    expect(snapshot.bank.upi).toBe(bank.upi);
  });

  it("tolerates a partial stored bank block", () => {
    const seller = sellerFrom({ gstin: "24AAHCI7997Q1ZG", bank: { name: "HDFC Bank" } });
    expect(seller.bank.name).toBe("HDFC Bank");
    expect(seller.bank.accountNo).toBe("");
  });
});

describe("sellerAuditShape", () => {
  it("is flat, so each bank field shows its own from → to in the log", () => {
    const shape = sellerAuditShape(deriveSeller({ gstin: "24AAHCI7997Q1ZG", bank }));
    expect(shape.bankAccountNo).toBe("50200097910552");
    for (const value of Object.values(shape)) expect(typeof value).toBe("string");
  });
});
