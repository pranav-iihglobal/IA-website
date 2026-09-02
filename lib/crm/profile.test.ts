import { describe, expect, it } from "vitest";
import { sampledOutcome, summariseTrading, tallyProducts, type ProfileInvoice } from "./profile";

/**
 * What a customer has actually bought.
 *
 * Pure, so the rules that decide a figure on screen can be checked without a
 * cluster. The one that matters most is that a cancelled invoice counts for
 * nothing — it stays visible on the profile, so if it were also counted the
 * rows and the total underneath would appear to contradict each other.
 */

const rupees = (n: number) => n * 100;

function invoice(over: Partial<ProfileInvoice> = {}): ProfileInvoice {
  return {
    id: "1",
    number: "IA.09.26.001",
    documentType: "invoice",
    againstNumber: "",
    issuedAt: "2026-09-01T00:00:00.000Z",
    status: "issued",
    grandTotalPaise: rupees(1000),
    paidPaise: rupees(1000),
    paymentStatus: "paid",
    isHistorical: false,
    lines: [],
    ...over,
  };
}

describe("with no invoices at all", () => {
  const t = summariseTrading([]);

  it("reports zeros rather than NaN", () => {
    expect(t.orders).toBe(0);
    expect(t.invoicedPaise).toBe(0);
    expect(t.receivedPaise).toBe(0);
    expect(t.outstandingPaise).toBe(0);
  });

  it("has no dates and no derived days", () => {
    expect(t.firstOrderAt).toBeNull();
    expect(t.lastOrderAt).toBeNull();
    expect(t.daysSinceLastOrder).toBeNull();
  });

  it("is a prospect, not dormant", () => {
    // Somebody who has never ordered has not lapsed; they have not started.
    expect(t.status).toBe("prospect");
  });
});

describe("totals", () => {
  it("adds up what was invoiced and what came in", () => {
    const t = summariseTrading([
      invoice({ id: "a", grandTotalPaise: rupees(1000), paidPaise: rupees(1000) }),
      invoice({ id: "b", grandTotalPaise: rupees(2500), paidPaise: rupees(500) }),
    ]);
    expect(t.orders).toBe(2);
    expect(t.invoicedPaise).toBe(rupees(3500));
    expect(t.receivedPaise).toBe(rupees(1500));
    expect(t.outstandingPaise).toBe(rupees(2000));
  });

  it("never shows a negative outstanding", () => {
    // An overpayment is real — a round transfer against an odd invoice — and
    // "owes −₹12" reads as a bug rather than as credit.
    const t = summariseTrading([
      invoice({ grandTotalPaise: rupees(988), paidPaise: rupees(1000) }),
    ]);
    expect(t.outstandingPaise).toBe(0);
  });
});

describe("cancelled invoices", () => {
  const invoices = [
    invoice({ id: "a", grandTotalPaise: rupees(1000), paidPaise: rupees(1000) }),
    invoice({
      id: "b",
      status: "cancelled",
      grandTotalPaise: rupees(9000),
      paidPaise: 0,
      lines: [{ description: "Ghost", quantity: 99, lineTotalPaise: rupees(9000) }],
    }),
  ];
  const t = summariseTrading(invoices);

  it("count for nothing in the totals", () => {
    expect(t.orders).toBe(1);
    expect(t.invoicedPaise).toBe(rupees(1000));
    expect(t.outstandingPaise).toBe(0);
  });

  it("are reported, so the row on screen is not a mystery", () => {
    expect(t.cancelledCount).toBe(1);
  });

  it("do not appear in what the customer buys", () => {
    expect(t.products.find((p) => p.description === "Ghost")).toBeUndefined();
  });
});

describe("dates", () => {
  it("finds the first and last order whatever order they arrive in", () => {
    const t = summariseTrading([
      invoice({ id: "b", issuedAt: "2026-03-15T00:00:00.000Z" }),
      invoice({ id: "a", issuedAt: "2025-06-02T00:00:00.000Z" }),
      invoice({ id: "c", issuedAt: "2026-01-09T00:00:00.000Z" }),
    ]);
    expect(t.firstOrderAt).toBe("2025-06-02T00:00:00.000Z");
    expect(t.lastOrderAt).toBe("2026-03-15T00:00:00.000Z");
  });

  it("ignores an invoice with no date rather than sorting it first", () => {
    const t = summariseTrading([
      invoice({ id: "a", issuedAt: null }),
      invoice({ id: "b", issuedAt: "2026-01-09T00:00:00.000Z" }),
    ]);
    expect(t.firstOrderAt).toBe("2026-01-09T00:00:00.000Z");
  });

  it("derives status from the LAST order, ignoring cancelled ones", () => {
    const t = summariseTrading([
      invoice({ id: "old", issuedAt: "2020-01-01T00:00:00.000Z" }),
      invoice({ id: "new", status: "cancelled", issuedAt: new Date().toISOString() }),
    ]);
    // A cancelled order today does not make a lapsed customer active again.
    expect(t.status).toBe("dormant");
  });
});

describe("what they buy", () => {
  it("rolls lines up per product, biggest spend first", () => {
    const t = summariseTrading([
      invoice({
        id: "a",
        lines: [
          { description: "FloraMax", quantity: 2, lineTotalPaise: rupees(500) },
          { description: "Mycorrhizal", quantity: 1, lineTotalPaise: rupees(900) },
        ],
      }),
      invoice({
        id: "b",
        lines: [{ description: "FloraMax", quantity: 10, lineTotalPaise: rupees(2500) }],
      }),
    ]);
    expect(t.products).toEqual([
      { description: "FloraMax", quantity: 12, valuePaise: rupees(3000) },
      { description: "Mycorrhizal", quantity: 1, valuePaise: rupees(900) },
    ]);
  });

  it("survives a line with nothing on it", () => {
    expect(tallyProducts([])).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* Credit notes on a profile                                                  */
/* -------------------------------------------------------------------------- */

/** A credit note as it is stored: negative, and marked paid. */
function creditNote(over: Partial<ProfileInvoice> = {}): ProfileInvoice {
  return invoice({
    id: "cn",
    number: "CN.09.26.001",
    documentType: "credit_note",
    againstNumber: "IA.09.26.001",
    grandTotalPaise: -rupees(400),
    paidPaise: -rupees(400),
    ...over,
  });
}

describe("credit notes on a profile", () => {
  it("nets off what was invoiced and what was received", () => {
    // The whole reason amounts are stored negative: this is a plain sum.
    const t = summariseTrading([invoice(), creditNote()]);
    expect(t.invoicedPaise).toBe(rupees(600));
    expect(t.receivedPaise).toBe(rupees(600));
    expect(t.outstandingPaise).toBe(0);
  });

  it("is not counted as an order", () => {
    /*
      A customer who bought once and returned half did not buy twice. Counting
      it would inflate order counts by exactly the number of corrections.
    */
    const t = summariseTrading([invoice(), creditNote()]);
    expect(t.orders).toBe(1);
    expect(t.creditNoteCount).toBe(1);
  });

  it("does not move the last-order date", () => {
    /*
      Status is derived from the last order. If a refund set that date, a
      dormant customer would read as Active because they sent goods BACK.
    */
    const t = summariseTrading([
      invoice({ issuedAt: "2026-01-05T00:00:00.000Z" }),
      creditNote({ issuedAt: "2026-09-01T00:00:00.000Z" }),
    ]);
    expect(t.lastOrderAt).toBe("2026-01-05T00:00:00.000Z");
  });

  it("reduces the product tally rather than adding a second entry", () => {
    const t = summariseTrading([
      invoice({
        lines: [{ description: "FloraMax — 25g", quantity: 10, lineTotalPaise: rupees(1000) }],
      }),
      creditNote({
        lines: [{ description: "FloraMax — 25g", quantity: -4, lineTotalPaise: -rupees(400) }],
      }),
    ]);
    expect(t.products).toHaveLength(1);
    expect(t.products[0].quantity).toBe(6);
    expect(t.products[0].valuePaise).toBe(rupees(600));
  });

  it("counts for nothing once cancelled", () => {
    const t = summariseTrading([invoice(), creditNote({ status: "cancelled" })]);
    expect(t.invoicedPaise).toBe(rupees(1000));
    expect(t.creditNoteCount).toBe(0);
    expect(t.cancelledCount).toBe(1);
  });
});

describe("sampledOutcome — did the sample convert?", () => {
  const sampled = [
    { id: "p1", name: "FloraMax" },
    { id: "p2", name: "Mycorrhizal" },
  ];

  it("reports a sampled product that was never bought", () => {
    expect(sampledOutcome(sampled, [])).toEqual([
      { productId: "p1", name: "FloraMax", bought: false, quantity: 0, valuePaise: 0 },
      { productId: "p2", name: "Mycorrhizal", bought: false, quantity: 0, valuePaise: 0 },
    ]);
  });

  it("matches on the product id, not on the printed description", () => {
    /*
      The invoice line's description is a SNAPSHOT taken at issue. Renaming a
      product must not break the answer, which is exactly why the free-text
      version of this could not be asked at all.
    */
    const out = sampledOutcome(sampled, [
      { productId: "p1", description: "FloraMax (old name)", quantity: 3, lineTotalPaise: 90000 },
    ]);
    expect(out[0]).toEqual({
      productId: "p1",
      name: "FloraMax",
      bought: true,
      quantity: 3,
      valuePaise: 90000,
    });
    expect(out[1].bought).toBe(false);
  });

  it("adds up repeat purchases of the same sampled product", () => {
    const out = sampledOutcome(sampled, [
      { productId: "p1", description: "FloraMax", quantity: 2, lineTotalPaise: 50000 },
      { productId: "p1", description: "FloraMax", quantity: 5, lineTotalPaise: 120000 },
    ]);
    expect(out[0].quantity).toBe(7);
    expect(out[0].valuePaise).toBe(170000);
  });

  it("does not count a sale that was fully credited back", () => {
    // Credit note quantities are stored negative. One bag bought, one bag
    // returned, is not a conversion — and "bought" has to agree with the
    // figures printed next to it.
    const out = sampledOutcome(sampled, [
      { productId: "p1", description: "FloraMax", quantity: 1, lineTotalPaise: 25000 },
      { productId: "p1", description: "FloraMax", quantity: -1, lineTotalPaise: -25000 },
    ]);
    expect(out[0].bought).toBe(false);
    expect(out[0].quantity).toBe(0);
    expect(out[0].valuePaise).toBe(0);
  });

  it("ignores lines whose product was deleted", () => {
    const out = sampledOutcome(sampled, [
      { productId: null, description: "Something removed", quantity: 4, lineTotalPaise: 10000 },
    ]);
    expect(out.every((p) => !p.bought)).toBe(true);
  });

  it("is empty when nothing was sampled", () => {
    expect(sampledOutcome([], [{ productId: "p1", description: "x", quantity: 1, lineTotalPaise: 1 }])).toEqual([]);
  });
});
