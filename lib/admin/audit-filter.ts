import { parseIstDateTimeInput } from "@/lib/time";

/**
 * What the activity log is being asked for, from its URL.
 *
 * Pure, so it can be tested without a database: the page reads the URL,
 * this turns it into a filter, lib/admin/history.ts runs it.
 *
 * WHITELISTED. `who` must be an email-shaped string or "unknown", `what` one
 * of the entities the log actually records, `action` one of the actions the
 * write paths use. Anything else is dropped rather than passed to Mongo.
 *
 * Dates are IST. "From 1 September" typed in Gujarat means midnight there,
 * not midnight UTC five and a half hours later — the same bug lib/time.ts
 * exists for, on the screen that would be used to investigate it.
 */

/** Every entity a write path records, with its label for the menu. */
export const AUDIT_ENTITIES: { value: string; label: string }[] = [
  { value: "Contact", label: "Contacts" },
  { value: "Invoice", label: "Invoices" },
  { value: "Purchase", label: "Purchases" },
  { value: "StockItem", label: "Stock" },
  { value: "Supplier", label: "Suppliers" },
  { value: "Product", label: "Products" },
  { value: "Post", label: "Blog posts" },
  { value: "Testimonial", label: "Testimonials" },
  { value: "User", label: "People" },
  { value: "Settings", label: "Settings" },
];

export const AUDIT_ACTIONS: { value: string; label: string }[] = [
  { value: "create", label: "Created" },
  { value: "update", label: "Edited" },
  { value: "delete", label: "Deleted" },
  { value: "issue", label: "Issued" },
  { value: "cancel", label: "Cancelled" },
  { value: "credit", label: "Credit note" },
  { value: "payment", label: "Payment" },
  { value: "stock", label: "Stock moved" },
  { value: "note", label: "Call logged" },
];

/** The actor value that means "no email was on the session". */
export const UNKNOWN_ACTOR = "unknown";

export interface AuditFilter {
  actor?: string;
  entity?: string;
  action?: string;
  /** Inclusive start, exclusive end — both real instants. */
  from?: Date;
  to?: Date;
  /** Entries strictly older than this instant: the "older" cursor. */
  before?: Date;
}

const DAY_MS = 86_400_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A yyyy-mm-dd from a date input, as midnight IST; null for anything else. */
function istMidnight(value: string): Date | null {
  return DATE.test(value) ? parseIstDateTimeInput(`${value}T00:00`) : null;
}

export function auditFilterFromParams(params: {
  who?: string;
  what?: string;
  action?: string;
  from?: string;
  to?: string;
  before?: string;
}): AuditFilter {
  const filter: AuditFilter = {};

  const who = (params.who ?? "").trim().toLowerCase();
  if (who === UNKNOWN_ACTOR || /^[^\s@]+@[^\s@]+$/.test(who)) filter.actor = who;

  if (AUDIT_ENTITIES.some((e) => e.value === params.what)) filter.entity = params.what;
  if (AUDIT_ACTIONS.some((a) => a.value === params.action)) filter.action = params.action;

  const from = istMidnight(params.from ?? "");
  if (from) filter.from = from;
  const to = istMidnight(params.to ?? "");
  // "To 4 September" means the whole of the 4th: exclusive end at the 5th.
  if (to) filter.to = new Date(to.getTime() + DAY_MS);

  if (params.before) {
    const before = new Date(params.before);
    if (!Number.isNaN(before.getTime())) filter.before = before;
  }

  return filter;
}

/** The Mongo query for a filter. Kept beside the parser so the two agree. */
export function auditQuery(filter: AuditFilter): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (filter.actor === UNKNOWN_ACTOR) query.actor = { $in: ["", null] };
  else if (filter.actor) query.actor = filter.actor;
  if (filter.entity) query.entity = filter.entity;
  if (filter.action) query.action = filter.action;

  const created: Record<string, Date> = {};
  if (filter.from) created.$gte = filter.from;
  // The cursor and the end both bound from above; the tighter one wins.
  const upper = [filter.to, filter.before].filter((d): d is Date => Boolean(d));
  if (upper.length > 0) created.$lt = new Date(Math.min(...upper.map((d) => d.getTime())));
  if (Object.keys(created).length > 0) query.createdAt = created;

  return query;
}
