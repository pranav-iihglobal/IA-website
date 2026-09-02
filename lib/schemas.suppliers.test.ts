import { describe, expect, it } from "vitest";
import { purchaseSchema, stockItemSchema, supplierSchema } from "./schemas";

/**
 * The supplier reference on a purchase and a stock item, and the record
 * itself. The GSTIN used to be an unvalidated string on every purchase; it
 * is validated once here, on the record, and snapshotted from there.
 */

const bill = {
  supplier: "Shree Poly Pack",
  billNo: "SP/1",
  category: "packaging",
  total: "118000",
};

describe("purchaseSchema — the supplier reference", () => {
  it("accepts a record id", () => {
    const parsed = purchaseSchema.safeParse({ ...bill, supplierId: "64f1c0ffee0ddba11ce55aaa" });
    expect(parsed.success).toBe(true);
  });

  it("accepts no id at all — a row from before suppliers were records", () => {
    expect(purchaseSchema.safeParse(bill).success).toBe(true);
  });

  it("refuses an id that is not one, before it can reach the database", () => {
    const parsed = purchaseSchema.safeParse({ ...bill, supplierId: "shree-poly-pack" });
    expect(parsed.success).toBe(false);
  });

  it("still needs a NAME, so an unlinked row cannot be nameless", () => {
    expect(purchaseSchema.safeParse({ ...bill, supplier: "" }).success).toBe(false);
  });

  it("validates the snapshot GSTIN the way the record's is validated", () => {
    expect(purchaseSchema.safeParse({ ...bill, supplierGstin: "not-a-gstin" }).success).toBe(false);
    expect(purchaseSchema.safeParse({ ...bill, supplierGstin: "24AABCS1429B1Z1" }).success).toBe(true);
  });
});

describe("stockItemSchema — the supplier reference", () => {
  it("is optional, and a stock item may have no supplier at all", () => {
    expect(stockItemSchema.safeParse({ name: "Sachet film" }).success).toBe(true);
    expect(
      stockItemSchema.safeParse({ name: "Sachet film", supplierId: "64f1c0ffee0ddba11ce55aaa" }).success,
    ).toBe(true);
  });
});

describe("supplierSchema", () => {
  it("needs a name and nothing else", () => {
    const parsed = supplierSchema.safeParse({ name: "Gokul Containers" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.state).toBe("Gujarat");
  });

  it("refuses a malformed GSTIN and uppercases a good one", () => {
    expect(supplierSchema.safeParse({ name: "x", gstin: "24AABCS1429B1Z" }).success).toBe(false);
    const parsed = supplierSchema.safeParse({ name: "x", gstin: "24aabcs1429b1z1" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.gstin).toBe("24AABCS1429B1Z1");
  });

  it("checks the phone like a contact's", () => {
    expect(supplierSchema.safeParse({ name: "x", phone: "12345" }).success).toBe(false);
    expect(supplierSchema.safeParse({ name: "x", phone: "98250 12345" }).success).toBe(true);
  });
});
