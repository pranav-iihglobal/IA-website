import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Who changed what, and when. Append-only.
 *
 * Two directors and an external CA touch these records. "Who changed this"
 * has to be answerable — not because anyone is suspected of anything, but
 * because when a filed figure and a stored figure disagree, the only useful
 * question is what happened to it, and a record that has been edited in place
 * cannot answer that.
 *
 * APPEND-ONLY IS THE WHOLE POINT. There is no update path and no delete path
 * in this module, deliberately: an audit trail that can be rewritten is not
 * an audit trail. Nothing here is ever corrected — a mistaken entry is
 * followed by another entry, never replaced.
 *
 * It also does real work on M0, where there are no automated backups and no
 * point-in-time restore. This is the only record of what a document used to
 * say.
 */

const auditSchema = new Schema(
  {
    /** Email of whoever did it, from the verified session — never the client. */
    actor: { type: String, required: true, trim: true },
    /** What happened: "create", "update", "delete", "issue", "cancel". */
    action: { type: String, required: true, trim: true },
    /** Which collection, e.g. "Contact", "Invoice". */
    entity: { type: String, required: true, trim: true, index: true },
    /** The document's id, as a string so it reads the same for any id type. */
    entityId: { type: String, required: true, trim: true },
    /**
     * The fields that changed, before and after. Only the CHANGED ones — a
     * full copy of every document doubles the collection, and M0 is 512 MB.
     */
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    /** Free text for anything the fields cannot say. */
    note: { type: String, default: "", trim: true },
  },
  {
    // createdAt only. There is no updatedAt because nothing is ever updated.
    timestamps: { createdAt: true, updatedAt: false },
  },
);

/** The question this collection exists to answer: what happened to THIS record. */
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
/** And: what did this person do. */
auditSchema.index({ actor: 1, createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ??
  model<AuditLogDoc>("AuditLog", auditSchema);

export interface AuditEntry {
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

/**
 * Record something that happened.
 *
 * NEVER THROWS. A failed audit write must not roll back or block the change it
 * describes — refusing to save an invoice because the log was unreachable
 * would turn a bookkeeping nicety into an outage. It is logged loudly instead,
 * so a silently-empty audit trail is visible in the runtime logs rather than
 * discovered a year later.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (error) {
    console.error("[audit] could not record", entry.entity, entry.entityId, error);
  }
}

/**
 * What actually changed between two versions of a document.
 *
 * Only the differing keys, so the log stays small enough to live on M0 beside
 * the data it describes. Compared by JSON so a Date, an ObjectId and a nested
 * object all behave — this is for a human reading a history, not for
 * reconstructing a document byte for byte.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  /** Fields that change on every save and would drown the entry. */
  ignore: string[] = ["updatedAt", "updatedBy", "_id", "__v", "createdAt"],
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const from = before ?? {};
  const to = after ?? {};
  const skip = new Set(ignore);

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};

  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    if (skip.has(key)) continue;
    if (JSON.stringify(from[key]) === JSON.stringify(to[key])) continue;
    changedBefore[key] = from[key] ?? null;
    changedAfter[key] = to[key] ?? null;
  }

  return { before: changedBefore, after: changedAfter };
}
