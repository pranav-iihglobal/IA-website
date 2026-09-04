import { describe, expect, it } from "vitest";
import {
  StockShortageError,
  assertNoShortage,
  movesFromLines,
  planStockMoves,
  type ShelfItem,
} from "./stock-moves";
import { InvoiceError } from "./invoice-error";

const P = "64a000000000000000000001";
const Q = "64a000000000000000000002";

const shelf: ShelfItem[] = [
  { id: "s1", productId: P, packLabel: "25 g sachet", onHand: 12, name: "FloraMax 25 g", unit: "sachet" },
  { id: "s2", productId: Q, packLabel: "250 g canister", onHand: 1, name: "Mycorrhizal 250 g", unit: "canister" },
];

describe("planStockMoves", () => {
  it("moves what is asked when the shelf has it", () => {
    const plan = planStockMoves(
      [{ index: 0, productId: P, packLabel: "25 g sachet", quantity: 10 }],
      shelf,
    );
    expect(plan.shortages).toEqual([]);
    expect(plan.moves).toEqual([{ itemId: "s1", quantity: 10, lineIndexes: [0] }]);
  });

  it("refuses the line that asks for more than is on hand, by its field key", () => {
    const plan = planStockMoves(
      [
        { index: 0, productId: Q, packLabel: "250 g canister", quantity: 1 },
        { index: 1, productId: P, packLabel: "25 g sachet", quantity: 30 },
      ],
      shelf,
    );
    expect(plan.moves).toEqual([{ itemId: "s2", quantity: 1, lineIndexes: [0] }]);
    expect(plan.shortages).toEqual([
      {
        index: 1,
        field: "lines.1.quantity",
        message: "Only 12 sachets of FloraMax 25 g on hand — this line asks for 30.",
      },
    ]);
  });

  it("sums two lines on one pack before checking, and tells both", () => {
    const plan = planStockMoves(
      [
        { index: 0, productId: P, packLabel: "25 g sachet", quantity: 8 },
        { index: 2, productId: P, packLabel: "25 g sachet", quantity: 8 },
      ],
      shelf,
    );
    expect(plan.moves).toEqual([]);
    expect(plan.shortages.map((s) => s.field)).toEqual(["lines.0.quantity", "lines.2.quantity"]);
    expect(plan.shortages[0].message).toBe(
      "Only 12 sachets of FloraMax 25 g on hand — these 2 lines ask for 16 between them.",
    );
  });

  it("merges two lines on one pack into one move when there is enough", () => {
    const plan = planStockMoves(
      [
        { index: 0, productId: P, packLabel: "25 g sachet", quantity: 5 },
        { index: 1, productId: P, packLabel: "25 g sachet", quantity: 6 },
      ],
      shelf,
    );
    expect(plan.moves).toEqual([{ itemId: "s1", quantity: 11, lineIndexes: [0, 1] }]);
  });

  it("ignores a pack with no linked item — nothing to move, nothing to refuse", () => {
    const plan = planStockMoves(
      [{ index: 0, productId: P, packLabel: "1 kg bag", quantity: 500 }],
      shelf,
    );
    expect(plan).toEqual({ moves: [], shortages: [] });
  });

  it("takes the shelf to exactly zero without complaint", () => {
    const plan = planStockMoves(
      [{ index: 0, productId: Q, packLabel: "250 g canister", quantity: 1 }],
      shelf,
    );
    expect(plan.shortages).toEqual([]);
  });

  it("says 'unit' singular when one is left", () => {
    const plan = planStockMoves(
      [{ index: 0, productId: Q, packLabel: "250 g canister", quantity: 2 }],
      shelf,
    );
    expect(plan.shortages[0].message).toBe(
      "Only 1 canister of Mycorrhizal 250 g on hand — this line asks for 2.",
    );
  });
});

describe("assertNoShortage", () => {
  it("returns the moves when nothing is short", () => {
    expect(assertNoShortage({ moves: [{ itemId: "s1", quantity: 1, lineIndexes: [0] }], shortages: [] })).toHaveLength(1);
  });

  it("throws an InvoiceError carrying the per-field messages", () => {
    const plan = planStockMoves(
      [
        { index: 0, productId: P, packLabel: "25 g sachet", quantity: 30 },
        { index: 1, productId: Q, packLabel: "250 g canister", quantity: 3 },
      ],
      shelf,
    );
    let caught: unknown;
    try {
      assertNoShortage(plan);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StockShortageError);
    expect(caught).toBeInstanceOf(InvoiceError);
    const error = caught as StockShortageError;
    expect(error.message).toBe("Lines 1, 2 ask for more than is on hand.");
    expect(Object.keys(error.fields)).toEqual(["lines.0.quantity", "lines.1.quantity"]);
  });

  it("names one line in the singular", () => {
    const error = new StockShortageError([
      { index: 3, field: "lines.3.quantity", message: "x" },
    ]);
    expect(error.message).toBe("Line 4 asks for more than is on hand.");
  });
});

describe("movesFromLines", () => {
  it("reads the item each line came off and restores by the piece, credit notes included", () => {
    const moves = movesFromLines([
      { stockItemId: "s1", quantity: -10 },
      { stockItemId: null, quantity: -4 },
      { stockItemId: "s1", quantity: -2 },
      { stockItemId: "s2", quantity: 1 },
    ]);
    expect(moves).toEqual([
      { itemId: "s1", quantity: 12, lineIndexes: [0, 2] },
      { itemId: "s2", quantity: 1, lineIndexes: [3] },
    ]);
  });

  it("is empty for a document issued before stock was linked", () => {
    expect(movesFromLines([{ quantity: 5 }])).toEqual([]);
  });
});
