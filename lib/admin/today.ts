import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import { StockItem } from "@/lib/db/models/StockItem";
import { Purchase } from "@/lib/db/models/Purchase";
import { outstandingPipeline } from "@/lib/erp/reports";
import { LOW_FILTER } from "@/lib/erp/inventory-list";
import { auditEntries, recordHref, type HistoryEntry } from "./history";
import { can, type Access } from "@/lib/auth/permissions";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * What needs doing today.
 *
 * Not a global right sidebar — the record pages already use their right
 * column, the lists would lose a card column, and on a phone a rail has
 * nowhere to go but the bottom. One panel on the dashboard, in the right
 * column on desktop and FIRST on a phone, because "what do I do today" is
 * why the panel is opened on a phone at all.
 *
 * Every line is derived live and every line is a link. Nothing on it that
 * is not a decision to make today: numbers and charts stay on the tiles and
 * the overviews, or this becomes wallpaper within a week. Sections the
 * viewer cannot open are OMITTED, not greyed — the accountant sees the
 * money lines and no leads.
 */

const LINES = 5;
const OVERDUE_INVOICE_DAYS = 60;

export interface FollowUpLine {
  id: string;
  name: string;
  phone: string;
  /** Days past the follow-up date; 0 means today. */
  overdueDays: number;
  nextAction: string;
}

export interface DebtLine {
  contactId: string | null;
  invoiceId: string;
  number: string;
  name: string;
  owedPaise: number;
  daysOld: number;
}

export interface StockLine {
  id: string;
  name: string;
  onHand: number;
  reorderLevel: number;
  unit: string;
}

export interface TodayPanelData {
  followUps?: { total: number; lines: FollowUpLine[] };
  overdueInvoices?: { total: number; owedPaise: number; lines: DebtLine[] };
  lowStock?: { total: number; lines: StockLine[] };
  unpaidBills?: { total: number; owedPaise: number };
  changes?: (HistoryEntry & { href: string | null })[];
}

const REAL = { isSample: { $ne: true } };

export async function todayPanel(access: Access, now = new Date()): Promise<TodayPanelData> {
  await connectToDatabase();
  const out: TodayPanelData = {};
  const crm = can(access, "crm:read");
  const billing = can(access, "billing:read");
  const users = can(access, "users:read");

  const cutoff = new Date(now.getTime() - OVERDUE_INVOICE_DAYS * 86_400_000);

  const [followUps, followUpTotal, overdue, lowStock, lowTotal, unpaid, changes] = await Promise.all([
    crm
      ? (Contact.find({ ...REAL, followUpAt: { $ne: null, $lte: now } })
          .select("name businessName phone followUpAt lead.nextAction")
          .sort({ followUpAt: 1 })
          .limit(LINES)
          .lean() as Promise<LeanDoc[]>)
      : null,
    crm ? Contact.countDocuments({ ...REAL, followUpAt: { $ne: null, $lte: now } }) : 0,
    billing
      ? Invoice.aggregate<LeanDoc>([
          ...outstandingPipeline({ ...REAL, issuedAt: { $lte: cutoff } }),
          {
            $facet: {
              top: [
                { $sort: { owedPaise: -1, issuedAt: 1 } },
                { $limit: LINES },
                { $project: { contactId: 1, number: 1, party: 1, owedPaise: 1, issuedAt: 1 } },
              ],
              total: [{ $group: { _id: null, count: { $sum: 1 }, owed: { $sum: "$owedPaise" } } }],
            },
          },
        ])
      : null,
    billing
      ? (StockItem.find({ ...REAL, ...LOW_FILTER })
          .select("name onHand reorderLevel unit")
          .sort({ name: 1 })
          .limit(LINES)
          .lean() as Promise<LeanDoc[]>)
      : null,
    billing ? StockItem.countDocuments({ ...REAL, ...LOW_FILTER }) : 0,
    billing
      ? Purchase.aggregate<{ count: number; owed: number }>([
          { $match: { ...REAL, paymentStatus: { $ne: "paid" } } },
          {
            $group: {
              _id: null,
              count: { $sum: 1 },
              owed: { $sum: { $subtract: [{ $ifNull: ["$totalPaise", 0] }, { $ifNull: ["$paidPaise", 0] }] } },
            },
          },
        ])
      : null,
    users ? auditEntries({}, LINES) : null,
  ]);

  if (followUps) {
    out.followUps = {
      total: followUpTotal,
      lines: followUps.map((c) => ({
        id: String(c._id),
        name: c.businessName || c.name || "(unnamed)",
        phone: c.phone ?? "",
        overdueDays: c.followUpAt ? Math.max(0, Math.floor((now.getTime() - new Date(c.followUpAt).getTime()) / 86_400_000)) : 0,
        nextAction: c.lead?.nextAction ?? "",
      })),
    };
  }
  if (overdue) {
    const facet = overdue[0] ?? { top: [], total: [] };
    out.overdueInvoices = {
      total: facet.total?.[0]?.count ?? 0,
      owedPaise: facet.total?.[0]?.owed ?? 0,
      lines: (facet.top as LeanDoc[]).map((i) => ({
        contactId: i.contactId ? String(i.contactId) : null,
        invoiceId: String(i._id),
        number: i.number ?? "",
        name: i.party?.businessName || i.party?.name || "",
        owedPaise: i.owedPaise ?? 0,
        daysOld: i.issuedAt ? Math.floor((now.getTime() - new Date(i.issuedAt).getTime()) / 86_400_000) : 0,
      })),
    };
  }
  if (lowStock) {
    out.lowStock = {
      total: lowTotal,
      lines: lowStock.map((s) => ({
        id: String(s._id),
        name: s.name ?? "",
        onHand: s.onHand ?? 0,
        reorderLevel: s.reorderLevel ?? 0,
        unit: s.unit ?? "",
      })),
    };
  }
  if (unpaid) {
    out.unpaidBills = { total: unpaid[0]?.count ?? 0, owedPaise: Math.max(0, unpaid[0]?.owed ?? 0) };
  }
  if (changes) {
    out.changes = changes.map((c) => ({ ...c, href: recordHref(c.entity, c.entityId) }));
  }
  return out;
}
