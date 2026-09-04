import { formatINR } from "@/lib/money";
import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog } from "@/lib/db/models/AuditLog";
import type { LeanDoc } from "@/lib/db/lean";
import { auditQuery, type AuditFilter } from "./audit-filter";

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
  entity: string;
  entityId: string;
  /** The record as a person would name it — a number, a name, a title. */
  summary: string;
  at: string;
  note: string;
  /** Field-by-field, only what actually changed. */
  changes: { field: string;
    /** The field, as a person calls it — see fieldLabel(). */
    label: string; from: string; to: string }[];
}

/**
 * Where a record lives, by the entity name the log stores.
 *
 * The activity screen showed the entity and never the id, so a row saying
 * "Invoice edited" could not be opened. Null for anything not listed rather
 * than a guessed path — a link that 404s is worse than no link.
 */
export function recordHref(entity: string, entityId: string): string | null {
  if (!entityId) return null;
  switch (entity) {
    case "Contact":
      return `/admin/contacts/${entityId}`;
    case "Invoice":
      return `/admin/invoices/${entityId}`;
    case "Purchase":
      return `/admin/purchases/${entityId}`;
    case "StockItem":
      return `/admin/stock/${entityId}`;
    case "Supplier":
      return `/admin/suppliers/${entityId}`;
    case "Product":
      return `/admin/products/${entityId}`;
    case "Post":
      return `/admin/blog/${entityId}`;
    case "Testimonial":
      return `/admin/testimonials/${entityId}`;
    case "User":
      return "/admin/users";
    case "Settings":
      return "/admin/settings";
    default:
      return null;
  }
}

/** Only what a person would recognise. Ids and internals stay out of it. */
export function summarise(entry: {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string;
}): string {
  const after = entry.after ?? {};
  const before = entry.before ?? {};
  for (const source of [after, before]) {
    const named = source.number ?? source.name ?? source.title ?? source.supplier;
    if (typeof named === "string" && named) return named;
  }
  return entry.note || "";
}

/**
 * Enough to see the shape of a record's life without paging.
 *
 * A single document does not accumulate many entries — a contact edited
 * weekly for a year is ~50 — so this is a cap against a runaway loop rather
 * than a page size.
 */
const MAX_ENTRIES = 50;

/**
 * What a stored field is called, to a person.
 *
 * The log showed "grandTotalPaise — → 720000" on a phone: the storage name
 * and the storage unit. The names the directors know, and camelCase pulled
 * apart for the rest.
 */
const FIELD_LABELS: Record<string, string> = {
  grandTotalPaise: "Total",
  totalPaise: "Total",
  paidPaise: "Paid",
  subtotalPaise: "Subtotal",
  number: "Number",
  party: "Customer",
  contactId: "Id",
  reason: "Reason",
  status: "Status",
  paymentStatus: "Payment",
  payment: "Payment",
  supplier: "Supplier",
  supplierGstin: "Supplier GSTIN",
  gstin: "GSTIN",
  onHand: "On hand",
  reorderLevel: "Reorder level",
  followUpAt: "Follow-up",
  followUpStatus: "Follow-up status",
  businessName: "Business",
  nameGu: "Name (Gujarati)",
  isSample: "Demo",
  stage: "Stage",
  modules: "Module access",
  lastOrderAt: "Last order",
  billDate: "Bill date",
  billNo: "Bill number",
  cancelledReason: "Reason",
  against: "Against",
  bankAccountNo: "Account number",
  bankIfsc: "IFSC",
  bankUpi: "UPI",
  bankName: "Bank",
  bankAccountName: "Account name",
  stateCode: "State code",
  pan: "PAN",
};

export function fieldLabel(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const words = field
    .replace(/Paise$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Render a stored value for a person. Never a raw id, never [object Object]. */
export function readable(value: unknown, field = ""): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "yes" : "no";
  // Money is stored in paise and must never be shown in it.
  if (typeof value === "number") return field.endsWith("Paise") ? formatINR(value) : String(value);
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

function toEntry(doc: LeanDoc): HistoryEntry {
  const before = (doc.before ?? {}) as Record<string, unknown>;
  const after = (doc.after ?? {}) as Record<string, unknown>;
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((f) => !HIDDEN.has(f))
    .sort();

  return {
    id: String(doc._id),
    actor: doc.actor ?? "",
    action: doc.action ?? "update",
    entity: doc.entity ?? "",
    entityId: doc.entityId ?? "",
    summary: summarise({ before, after, note: doc.note }),
    at: doc.createdAt ? new Date(doc.createdAt).toISOString() : "",
    note: doc.note ?? "",
    changes: fields.map((field) => ({
      field,
      label: fieldLabel(field),
      from: readable(before[field], field),
      to: readable(after[field], field),
    })),
  };
}

/**
 * Entries matching a filter, newest first.
 *
 * The activity screen's query, generalised from recordHistory() so both
 * render the same from → to changes through the same readable().
 */
export async function auditEntries(filter: AuditFilter, limit: number): Promise<HistoryEntry[]> {
  await connectToDatabase();
  const docs = (await AuditLog.find(auditQuery(filter))
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean()) as LeanDoc[];
  return docs.map(toEntry);
}

export async function recordHistory(
  entity: string,
  entityId: string,
): Promise<HistoryEntry[]> {
  await connectToDatabase();

  const docs = (await AuditLog.find({ entity, entityId })
    .sort({ createdAt: -1 })
    .limit(MAX_ENTRIES)
    .lean()) as LeanDoc[];

  return docs.map(toEntry);
}
