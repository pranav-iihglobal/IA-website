import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog } from "@/lib/db/models/AuditLog";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * What happened to THIS record.
 *
 * The audit collection has carried an index for exactly this question since it
 * was written — `{ entity, entityId, createdAt }`, with a comment calling it
 * "the question this collection exists to answer" — and nothing has ever asked
 * it. The one reader is /admin/activity, which shows every change to every
 * record mixed together, newest first. That answers "what has been happening";
 * it cannot answer "who changed this invoice, and what did it say before".
 *
 * That second question is the one the log was justified by: two directors and
 * an external CA touch these records, and when a filed figure and a stored
 * figure disagree, what is needed is the history of that one document.
 */

export interface HistoryEntry {
  id: string;
  actor: string;
  action: string;
  at: string;
  note: string;
  /** Field-by-field, only what actually changed. */
  changes: { field: string; from: string; to: string }[];
}

/**
 * Enough to see the shape of a record's life without paging.
 *
 * A single document does not accumulate many entries — a contact edited
 * weekly for a year is ~50 — so this is a cap against a runaway loop rather
 * than a page size.
 */
const MAX_ENTRIES = 50;

/** Render a stored value for a person. Never a raw id, never [object Object]. */
function readable(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.length === 0 ? "—" : `${value.length} item${value.length === 1 ? "" : "s"}`;
  }
  if (value instanceof Date) return value.toISOString();
  /*
    An object with no obvious label. Naming its keys says more than dumping
    its contents — "changed gstin, territory" is what somebody wants, and the
    contents may be long.
  */
  const keys = Object.keys(value as Record<string, unknown>);
  return keys.length ? keys.slice(0, 6).join(", ") : "—";
}

/**
 * Fields that mean nothing to a reader, or repeat what the row already says.
 *
 * `updatedBy` is the actor, which is already the first thing on the entry;
 * `version` is Mongoose bookkeeping.
 */
const HIDDEN = new Set(["updatedBy", "version", "__v", "_id", "id"]);

export async function recordHistory(
  entity: string,
  entityId: string,
): Promise<HistoryEntry[]> {
  await connectToDatabase();

  const docs = (await AuditLog.find({ entity, entityId })
    .sort({ createdAt: -1 })
    .limit(MAX_ENTRIES)
    .lean()) as LeanDoc[];

  return docs.map((doc) => {
    const before = (doc.before ?? {}) as Record<string, unknown>;
    const after = (doc.after ?? {}) as Record<string, unknown>;
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((f) => !HIDDEN.has(f))
      .sort();

    return {
      id: String(doc._id),
      actor: doc.actor ?? "",
      action: doc.action ?? "update",
      at: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
      note: doc.note ?? "",
      changes: fields.map((field) => ({
        field,
        from: readable(before[field]),
        to: readable(after[field]),
      })),
    };
  });
}
