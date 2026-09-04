import { describe, expect, it } from "vitest";
import { describeQuantity, toPieces } from "./quantity";

describe("describeQuantity", () => {
  it("reads pieces as a plain count", () => {
    expect(describeQuantity({ quantity: 30 })).toBe("30");
    expect(describeQuantity({ quantity: 30, uom: "piece" })).toBe("30");
  });

  it("reads a box order as boxes with the pieces in brackets", () => {
    expect(describeQuantity({ quantity: 30, uom: "box", boxes: 3, unitsPerBox: 10 })).toBe("3 boxes (30)");
    expect(describeQuantity({ quantity: 10, uom: "box", boxes: 1, unitsPerBox: 10 })).toBe("1 box (10)");
  });

  it("shows a credit note's negative quantity as a count", () => {
    expect(describeQuantity({ quantity: -30, uom: "box", boxes: -3, unitsPerBox: 10 })).toBe("3 boxes (30)");
  });
});

describe("toPieces", () => {
  it("multiplies boxes out and leaves pieces alone", () => {
    expect(toPieces(3, "box", 10)).toBe(30);
    expect(toPieces(3, "piece", 10)).toBe(3);
  });
});
