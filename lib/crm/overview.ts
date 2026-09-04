import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Product } from "@/lib/db/models/Product";
import { monthRange } from "@/lib/erp/reports";
import { istParts } from "@/lib/time";
import { FOLLOW_UP_LABELS, STATUS_LABELS, statusCutoffs, type ContactStatus } from "./shape";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * The Customers overview: the sampling programme's questions, answered.
 *
 * Nothing on screen could say how many leads were at each stage, how many
 * sampled leads became customers, or which districts the customers are in.
 * Every figure here is DERIVED, never stored, and every one links to the
 * filtered list that explains it — which is why the status buckets use the
 * same cut-offs the list filter uses (statusCutoffs), so the count on this
 * page and the rows behind its link cannot disagree.
 *
 * Real contacts only. Sample rows are marked on every list; a count that
 * silently included them would be the dashboard's sample-revenue defect
 * again, on the screen built to be trusted.
 */

export interface Count {
  key: string;
  label: string;
  count: number;
  href: string;
}

export interface ProductConversion {
  productId: string;
  name: string;
  sampled: number;
  converted: number;
}

export interface DistrictRow {
  district: string;
  customers: number;
  leads: number;
}

export interface CrmOverview {
  monthLabel: string;
  leads: { total: number; byStage: Count[] };
  sampling: { sampled: number; converted: number; byProduct: ProductConversion[] };
  followUps: { overdue: number; byOwner: Count[] };
  newThisMonth: { leads: number; customers: number };
  newLastMonth: { leads: number; customers: number };
  customers: { total: number; byStatus: Count[] };
  districts: DistrictRow[];
  sampleContacts: number;
}

const REAL = { isSample: { $ne: true } };

/**
 * Leads by pipeline stage, in the order the stages happen.
 *
 * Shared by the Customers overview and the dashboard's funnel, so the two
 * cannot disagree about how many leads are "interested".
 */
export async function leadStageCounts(): Promise<{ total: number; byStage: Count[] }> {
  await connectToDatabase();
  const stages = await Contact.aggregate<{ _id: string | null; n: number }>([
    { $match: { ...REAL, kind: "lead" } },
    { $group: { _id: "$lead.followUpStatus", n: { $sum: 1 } } },
  ]);
  const stageOf = new Map(stages.map((s) => [s._id ?? "", s.n]));
  return {
    total: stages.reduce((t, s) => t + s.n, 0),
    byStage: Object.entries(FOLLOW_UP_LABELS).map(([key, label]) => ({
      key,
      label,
      count: stageOf.get(key) ?? 0,
      href: `/admin/leads?filter=${key}`,
    })),
  };
}

export async function crmOverview(now = new Date()): Promise<CrmOverview> {
  await connectToDatabase();
  const { year, month } = istParts(now);
  const thisMonth = monthRange(year, month);
  const lastMonth = monthRange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  const { atRisk, dormant } = statusCutoffs(now);

  const [leads, sampled, owners, created, statuses, districts, sampleContacts] = await Promise.all([
    leadStageCounts(),
    /*
      Sampled = carries at least one sampled product. Converted = that same
      contact is a customer now. The profile answers "did they BUY what we
      sampled" line by line (sampledOutcome); this is the programme-level
      count, and the two are deliberately the same question at two scales.
    */
    Contact.aggregate<{ _id: unknown; sampled: number; converted: number }>([
      { $match: { ...REAL, "lead.productIds.0": { $exists: true } } },
      { $unwind: "$lead.productIds" },
      {
        $group: {
          _id: "$lead.productIds",
          sampled: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ["$kind", "customer"] }, 1, 0] } },
        },
      },
    ]),
    Contact.aggregate<{ _id: string | null; n: number }>([
      { $match: { ...REAL, followUpAt: { $ne: null, $lte: now } } },
      { $group: { _id: "$owner", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
    ]),
    Contact.aggregate<{ _id: { month: string; kind: string }; n: number }>([
      { $match: { ...REAL, createdAt: { $gte: lastMonth.from, $lt: thisMonth.to } } },
      {
        $group: {
          _id: {
            month: { $cond: [{ $gte: ["$createdAt", thisMonth.from] }, "this", "last"] },
            kind: "$kind",
          },
          n: { $sum: 1 },
        },
      },
    ]),
    Contact.aggregate<{ _id: ContactStatus; n: number }>([
      { $match: { ...REAL, kind: "customer" } },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: [{ $ifNull: ["$customer.lastOrderAt", null] }, null] }, then: "prospect" },
                { case: { $gt: ["$customer.lastOrderAt", atRisk] }, then: "active" },
                { case: { $gt: ["$customer.lastOrderAt", dormant] }, then: "at_risk" },
              ],
              default: "dormant",
            },
          },
          n: { $sum: 1 },
        },
      },
    ]),
    Contact.aggregate<{ _id: string; customers: number; leads: number }>([
      { $match: { ...REAL, district: { $nin: ["", null] } } },
      {
        $group: {
          _id: "$district",
          customers: { $sum: { $cond: [{ $eq: ["$kind", "customer"] }, 1, 0] } },
          leads: { $sum: { $cond: [{ $eq: ["$kind", "lead"] }, 1, 0] } },
        },
      },
      { $sort: { customers: -1, leads: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    Contact.countDocuments({ isSample: true }),
  ]);

  // Names for the sampled products, in one read.
  const productIds = sampled.map((s) => s._id);
  const products = (await Product.find({ _id: { $in: productIds } })
    .select("name")
    .lean()) as LeanDoc[];
  const names = new Map(products.map((p) => [String(p._id), p.name?.en ?? p.name ?? "(product)"]));

  const statusOf = new Map(statuses.map((s) => [s._id, s.n]));
  const customersTotal = statuses.reduce((t, s) => t + s.n, 0);
  const byStatus: Count[] = (["active", "at_risk", "dormant", "prospect"] as ContactStatus[]).map(
    (key) => ({
      key,
      label: STATUS_LABELS[key],
      count: statusOf.get(key) ?? 0,
      href: `/admin/customers?filter=${key}`,
    }),
  );

  const createdOf = (m: string, k: string) =>
    created.find((c) => c._id.month === m && c._id.kind === k)?.n ?? 0;

  const byProduct: ProductConversion[] = sampled
    .map((s) => ({
      productId: String(s._id),
      name: names.get(String(s._id)) ?? "(product)",
      sampled: s.sampled,
      converted: s.converted,
    }))
    .sort((a, b) => b.sampled - a.sampled);

  return {
    monthLabel: `${new Date(thisMonth.from.getTime() + 6 * 3_600_000).toLocaleString("en", { month: "long", timeZone: "UTC" })} ${year}`,
    leads,
    sampling: {
      sampled: byProduct.reduce((t, p) => t + p.sampled, 0),
      converted: byProduct.reduce((t, p) => t + p.converted, 0),
      byProduct,
    },
    followUps: {
      overdue: owners.reduce((t, o) => t + o.n, 0),
      byOwner: owners.map((o) => ({
        key: o._id || "unassigned",
        label: o._id || "Unassigned",
        count: o.n,
        href: "/admin/leads?filter=due",
      })),
    },
    newThisMonth: { leads: createdOf("this", "lead"), customers: createdOf("this", "customer") },
    newLastMonth: { leads: createdOf("last", "lead"), customers: createdOf("last", "customer") },
    customers: { total: customersTotal, byStatus },
    districts: districts.map((d) => ({ district: d._id, customers: d.customers, leads: d.leads })),
    sampleContacts,
  };
}
