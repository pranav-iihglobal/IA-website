import { describe, expect, it } from "vitest";
import { tradingDelta } from "./trading";

/**
 * What a document does to the customer record. Pure, so the arithmetic that
 * keeps the list and the profile agreeing is pinned without a cluster.
 */
describe("tradingDelta", () => {
  it("counts an invoice as one order and its total as revenue", () => {
    expect(tradingDelta({ documentType: "invoice", grandTotalPaise: 105050 }, "apply")).toEqual({
      orders: 1,
      revenuePaise: 105050,
    });
  });

  it("undoes exactly what it applied", () => {
    expect(tradingDelta({ documentType: "invoice", grandTotalPaise: 105050 }, "undo")).toEqual({
      orders: -1,
      revenuePaise: -105050,
    });
  });

  it("treats a credit note as money moving back, not as an order", () => {
    // A credit note's grand total is stored negative.
    expect(tradingDelta({ documentType: "credit_note", grandTotalPaise: -20000 }, "apply")).toEqual({
      orders: 0,
      revenuePaise: -20000,
    });
  });

  it("treats a sample note as nothing — nothing was bought", () => {
    expect(tradingDelta({ documentType: "sample_note", grandTotalPaise: 0 }, "apply")).toEqual({
      orders: 0,
      revenuePaise: 0,
    });
  });

  it("reads a missing documentType as an invoice, like the rest of the ERP", () => {
    expect(tradingDelta({ grandTotalPaise: 500 }, "apply").orders).toBe(1);
  });
});
