import type { LeanDoc } from "@/lib/db/lean";

/**
 * The shape the admin lists consume, and the rules that derive it.
 *
 * Kept out of the route handlers so the status rule has exactly one
 * definition — it is read by the list, the detail view and eventually the
 * dashboard, and three copies of a threshold is three chances to disagree.
 */

export type ContactStatus = "prospect" | "active" | "at_risk" | "dormant";

export const STATUS_LABELS: Record<ContactStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  at_risk: "At risk",
  dormant: "Dormant",
};

/** Days since the last order that tip a customer into each state. */
export const AT_RISK_AFTER_DAYS = 90;
export const DORMANT_AFTER_DAYS = 180;

/**
 * Status is DERIVED, never stored.
 *
 * Their spreadsheet computes it from "Days Since Last Order" in a formula,
 * and that is the right call: a stored status is correct on the day it is
 * typed and wrong every day after. Nothing here writes a status field.
 */
export function deriveStatus(lastOrderAt: Date | string | null | undefined): ContactStatus {
  if (!lastOrderAt) return "prospect";
  const then = lastOrderAt instanceof Date ? lastOrderAt : new Date(lastOrderAt);
  if (Number.isNaN(then.getTime())) return "prospect";
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days >= DORMANT_AFTER_DAYS) return "dormant";
  if (days >= AT_RISK_AFTER_DAYS) return "at_risk";
  return "active";
}

/** Whole days since a date, or null. For "last ordered 29 days ago". */
export function daysSince(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const then = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86_400_000);
}

export interface ContactRow {
  id: string;
  contactId: string;
  /** Mongoose __v, so a save can refuse to overwrite a newer one. */
  version: number;
  kind: "lead" | "customer";
  channel: "b2c" | "b2b" | "";
  name: string;
  businessName: string;
  phone: string;
  place: string;
  district: string;
  region: string;
  crop: string;
  source: string;
  owner: string;
  status: ContactStatus;
  daysSinceLastOrder: number | null;
  lifetimeOrders: number;
  lifetimeRevenuePaise: number;
  followUpStatus: string;
  nextAction: string;
  followUpAt: string | null;
  /** True when the follow-up date has passed. Drives the "due" badge. */
  overdue: boolean;
  gstin: string;
  isSample: boolean;
  updatedAt: string | null;
}

/** Village, Taluka, District — skipping the parts that are blank. */
export function joinPlace(...parts: (string | undefined | null)[]): string {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(", ");
}

export function toContactRow(doc: LeanDoc): ContactRow {
  const followUpAt: Date | null = doc.followUpAt ?? null;
  return {
    id: String(doc._id),
    // The version the form loaded with — sent back on save so a second
    // save cannot silently overwrite a first. See lib/admin/concurrency.ts.
    version: typeof doc.__v === "number" ? doc.__v : 0,
    contactId: doc.contactId ?? "",
    kind: doc.kind ?? "lead",
    channel: doc.channel ?? "",
    name: doc.name ?? "",
    businessName: doc.businessName ?? "",
    phone: doc.phone ?? "",
    place: joinPlace(doc.village, doc.taluka),
    district: doc.district ?? "",
    region: doc.region ?? "",
    crop: doc.crop ?? "",
    source: doc.source ?? "other",
    owner: doc.owner ?? "",
    status: deriveStatus(doc.customer?.lastOrderAt),
    daysSinceLastOrder: daysSince(doc.customer?.lastOrderAt),
    lifetimeOrders: doc.customer?.lifetimeOrders ?? 0,
    lifetimeRevenuePaise: doc.customer?.lifetimeRevenuePaise ?? 0,
    followUpStatus: doc.lead?.followUpStatus ?? "",
    nextAction: doc.lead?.nextAction ?? "",
    followUpAt: followUpAt ? new Date(followUpAt).toISOString() : null,
    overdue: Boolean(followUpAt && new Date(followUpAt).getTime() <= Date.now()),
    gstin: doc.dealer?.gstin ?? "",
    isSample: Boolean(doc.isSample),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}
