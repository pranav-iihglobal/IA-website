import { StockItem } from "@/lib/db/models/StockItem";
import { recordAudit } from "@/lib/db/models/AuditLog";
import { InvoiceError } from "./invoice-error";

/**
 * Stock that moves when a sale does.
 *
 * `StockItem.onHand` used to be a count and nothing else — the alert "needs
 * ordering" was as fresh as the last time somebody walked to the godown. A
 * stock item LINKED to a product pack now moves with every document that
 * moves goods: an invoice takes pieces off the shelf, a credit note or a
 * cancellation puts them back, and a line asking for more than is on hand
 * is refused ON THAT LINE before any invoice number is consumed. A count
 * still overrides everything, because the shelf is the truth and the book
 * only follows it.
 *
 * Unlinked items — packaging, raw material, a finished good nobody has linked
 * yet — are not touched and never refuse anything. Linking is what opts a
 * pack in.
 *
 * The planning half is pure and tested; the moving half is two guarded
 * updates with a best-effort rollback, because Atlas M0 has no transactions.
 */

/** What a document line asks of the shelf. */
export interface MoveRequest {
  /** Position on the document, for the error key `lines.N.quantity`. */
  index: number;
  productId: string;
  packLabel: string;
  /** PIECES, positive. Boxes have already been multiplied out. */
  quantity: number;
}

/** The shelf as it stands. */
export interface ShelfItem {
  id: string;
  productId: string;
  packLabel: string;
  onHand: number;
  name: string;
  unit: string;
}

export interface StockMove {
  itemId: string;
  /** Pieces to take off (deduct) or put back (restore). Always positive. */
  quantity: number;
  /** Which lines this move serves; two lines on one pack merge into one move. */
  lineIndexes: number[];
}

export interface Shortage {
  index: number;
  /** The form's error key for that line's quantity field. */
  field: string;
  message: string;
}

export interface StockPlan {
  moves: StockMove[];
  shortages: Shortage[];
}

function plural(n: number, unit: string): string {
  const word = unit.trim() || "unit";
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/**
 * Which items move, by how much, and which lines cannot be met.
 *
 * Lines for the same pack are summed BEFORE the check — two lines of 20
 * against 30 on hand is one ask of 40 and is short, and every line of that
 * pack is told so. A line whose pack has no linked item is skipped: nothing
 * to move, nothing to refuse.
 */
export function planStockMoves(lines: MoveRequest[], items: ShelfItem[]): StockPlan {
  const byPack = new Map<string, ShelfItem>();
  for (const item of items) byPack.set(`${item.productId} ${item.packLabel}`, item);

  const asks = new Map<string, { item: ShelfItem; quantity: number; lineIndexes: number[] }>();
  for (const line of lines) {
    const item = byPack.get(`${line.productId} ${line.packLabel}`);
    if (!item || line.quantity <= 0) continue;
    const ask = asks.get(item.id) ?? { item, quantity: 0, lineIndexes: [] };
    ask.quantity += line.quantity;
    ask.lineIndexes.push(line.index);
    asks.set(item.id, ask);
  }

  const moves: StockMove[] = [];
  const shortages: Shortage[] = [];
  for (const { item, quantity, lineIndexes } of asks.values()) {
    if (quantity > item.onHand) {
      const asked =
        lineIndexes.length > 1
          ? `these ${lineIndexes.length} lines ask for ${quantity} between them.`
          : `this line asks for ${quantity}.`;
      const message = `Only ${plural(item.onHand, item.unit)} of ${item.name} on hand — ${asked}`;
      for (const index of lineIndexes) {
        shortages.push({ index, field: `lines.${index}.quantity`, message });
      }
      continue;
    }
    moves.push({ itemId: item.id, quantity, lineIndexes });
  }
  shortages.sort((a, b) => a.index - b.index);
  return { moves, shortages };
}

/**
 * A refusal the form can put under the right field.
 *
 * An InvoiceError, so every route that already turns those into a 400 for
 * the person keeps doing so; `fields` is the extra the route passes along.
 */
export class StockShortageError extends InvoiceError {
  readonly fields: Record<string, string>;

  constructor(shortages: Shortage[]) {
    const lines = [...new Set(shortages.map((s) => s.index + 1))];
    super(
      lines.length === 1
        ? `Line ${lines[0]} asks for more than is on hand.`
        : `Lines ${lines.join(", ")} ask for more than is on hand.`,
    );
    this.name = "StockShortageError";
    this.fields = Object.fromEntries(shortages.map((s) => [s.field, s.message]));
  }
}

/** Refuse the whole document when any line is short — nothing has moved yet. */
export function assertNoShortage(plan: StockPlan): StockMove[] {
  if (plan.shortages.length > 0) throw new StockShortageError(plan.shortages);
  return plan.moves;
}

/** Moves for a document that already knows which item each line came off. */
export function movesFromLines(
  lines: { stockItemId?: unknown; quantity?: number }[],
): StockMove[] {
  const merged = new Map<string, StockMove>();
  lines.forEach((line, index) => {
    if (!line.stockItemId) return;
    const pieces = Math.abs(line.quantity ?? 0);
    if (pieces <= 0) return;
    const id = String(line.stockItemId);
    const move = merged.get(id) ?? { itemId: id, quantity: 0, lineIndexes: [] };
    move.quantity += pieces;
    move.lineIndexes.push(index);
    merged.set(id, move);
  });
  return [...merged.values()];
}

/* -------------------------------------------------------------------------- */
/* The database half                                                          */
/* -------------------------------------------------------------------------- */

/** The linked items for the packs these lines name. */
export async function shelfItemsFor(
  lines: { productId: string; packLabel: string }[],
): Promise<ShelfItem[]> {
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  if (productIds.length === 0) return [];
  const docs = await StockItem.find({ productId: { $in: productIds } })
    .select("productId packLabel onHand name unit")
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    productId: String(d.productId),
    packLabel: d.packLabel ?? "",
    onHand: d.onHand ?? 0,
    name: d.name ?? "",
    unit: d.unit ?? "unit",
  }));
}

/**
 * Take the pieces off the shelf, one item at a time, each update guarded by
 * `onHand >= quantity` so two invoices racing for the last box cannot both
 * have it. If a later item comes up short — somebody else got there between
 * the plan and this write — the ones already taken are put back and the
 * shortage is thrown as the same per-line refusal.
 */
export async function deductStock(
  moves: StockMove[],
  reference: { note: string; actor: string },
): Promise<void> {
  const done: StockMove[] = [];
  for (const move of moves) {
    const result = await StockItem.updateOne(
      { _id: move.itemId, onHand: { $gte: move.quantity } },
      { $inc: { onHand: -move.quantity } },
    );
    if (result.modifiedCount === 1) {
      done.push(move);
      continue;
    }
    await restoreStock(done, {
      note: `${reference.note} (undone: another sale took the stock first)`,
      actor: reference.actor,
    });
    const item = await StockItem.findById(move.itemId).select("name unit onHand").lean();
    throw new StockShortageError(
      move.lineIndexes.map((index) => ({
        index,
        field: `lines.${index}.quantity`,
        message: `Only ${plural(item?.onHand ?? 0, item?.unit ?? "unit")} of ${item?.name ?? "that item"} on hand now — another sale took some while this was open.`,
      })),
    );
  }
  await auditMoves(done, -1, reference);
}

/** Put the pieces back — a credit note, a cancellation, or a failed write. */
export async function restoreStock(
  moves: StockMove[],
  reference: { note: string; actor: string },
): Promise<void> {
  for (const move of moves) {
    await StockItem.updateOne({ _id: move.itemId }, { $inc: { onHand: move.quantity } });
  }
  await auditMoves(moves, 1, reference);
}

/** One `stock` entry per item moved, naming the document that moved it. */
async function auditMoves(
  moves: StockMove[],
  sign: 1 | -1,
  reference: { note: string; actor: string },
): Promise<void> {
  for (const move of moves) {
    await recordAudit({
      actor: reference.actor,
      action: "stock",
      entity: "StockItem",
      entityId: move.itemId,
      after: { onHandChange: sign * move.quantity },
      note: reference.note,
    });
  }
}
