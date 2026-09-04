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

/**
 * Where a lead has got to, for reading.
 *
 * The stored values are the sheet's own vocabulary; these are how they are
 * written on screen. Beside STATUS_LABELS deliberately: a lead's stage and a
 * customer's derived status are the two "where are they" answers this CRM
 * gives, and keeping them apart is what stops a lead being labelled with a
 * customer's.
 */
export const FOLLOW_UP_LABELS: Record<string, string> = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not interested",
  converted: "Converted",
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

export const CONTACT_STATUSES: ContactStatus[] = ["active", "at_risk", "dormant", "prospect"];

/**
 * The instants that separate the four states, for a QUERY.
 *
 * deriveStatus() reads a stored date and answers for one contact; a list
 * filter and the overview need the same rule as a Mongo match on
 * `customer.lastOrderAt`. One set of cut-offs, derived from the same two
 * constants, so "12 at-risk customers" on the overview and the twelve rows
 * behind its link cannot disagree.
 */
export function statusCutoffs(now: Date = new Date()): { atRisk: Date; dormant: Date } {
  return {
    atRisk: new Date(now.getTime() - AT_RISK_AFTER_DAYS * 86_400_000),
    dormant: new Date(now.getTime() - DORMANT_AFTER_DAYS * 86_400_000),
  };
}

/** The `customer.lastOrderAt` condition that means this status, or null for an unknown one. */
export function statusFilter(
  status: string,
  now: Date = new Date(),
): Record<string, unknown> | null {
  const { atRisk, dormant } = statusCutoffs(now);
  switch (status) {
    case "active":
      return { "customer.lastOrderAt": { $gt: atRisk } };
    case "at_risk":
      return { "customer.lastOrderAt": { $gt: dormant, $lte: atRisk } };
    case "dormant":
      return { "customer.lastOrderAt": { $ne: null, $lte: dormant } };
    case "prospect":
      // Missing and null alike — a customer who has never ordered.
      return { "customer.lastOrderAt": null };
    default:
      return null;
  }
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
  /** "sample" while they are only receiving samples; SMP- ids. */
  stage: "sample" | "customer";
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
    stage: doc.stage === "sample" ? "sample" : "customer",
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
