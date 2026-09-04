/**
 * How a line's quantity reads.
 *
 * A dealer buys by the box — "3 boxes" — and the line stores what that came
 * to in PIECES, because pieces are what the tax engine, the HSN summary,
 * the credit ceiling and the stock count all work in. This turns the stored
 * facts back into what was ordered, for the form, the print and the list.
 * Dependency-free so the client can use it.
 */
export type Uom = "piece" | "box";

export interface QuantityFacts {
  /** Pieces. Negative on a credit note. */
  quantity: number;
  uom?: string;
  boxes?: number;
  unitsPerBox?: number;
}

export function describeQuantity(line: QuantityFacts): string {
  const pieces = Math.abs(line.quantity ?? 0);
  const boxes = Math.abs(line.boxes ?? 0);
  if (line.uom === "box" && boxes > 0) {
    return `${boxes} box${boxes === 1 ? "" : "es"} (${pieces})`;
  }
  return String(pieces);
}

/** Pieces for a quantity typed in the given unit. */
export function toPieces(quantity: number, uom: Uom, unitsPerBox: number): number {
  return uom === "box" ? quantity * unitsPerBox : quantity;
}
