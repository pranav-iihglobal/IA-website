import Link from "next/link";
import { formatRupees } from "@/lib/money";
import type { DashboardFigures } from "@/lib/erp/reports";

/**
 * The numbers a director opens the panel to see.
 *
 * Chosen for what they prompt, not for what is easy to count. Revenue this
 * month against last is the shape of the business; outstanding is the one that
 * means somebody should ring a customer; stock below its reorder level means
 * somebody should place an order.
 *
 * No charts. Two data points do not need one, and the space is better spent
 * making the figures large enough to read across a desk.
 */

function Tile({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "danger" | "good";
}) {
  const body = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={`mt-1.5 font-display text-2xl font-bold tabular-nums ${
          tone === "danger"
            ? "text-danger"
            : tone === "good"
              ? "text-olive"
              : "text-ink-strong"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </>
  );

  return href ? (
    <Link href={href} className="admin-card block p-4 transition-shadow hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="admin-card p-4">{body}</div>
  );
}

/** "up 24%" / "down 8%" / null when there is nothing to compare against. */
function change(now: number, before: number): string | null {
  if (before <= 0) return now > 0 ? "first month with sales" : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return "level with last month";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% on last month`;
}

export function BusinessTiles({ figures }: { figures: DashboardFigures }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile
        label="This month"
        value={formatRupees(figures.monthRevenuePaise)}
        hint={
          change(figures.monthRevenuePaise, figures.lastMonthRevenuePaise) ??
          `${figures.monthInvoices} invoice${figures.monthInvoices === 1 ? "" : "s"}`
        }
        href="/admin/invoices"
      />
      <Tile
        label="This financial year"
        value={formatRupees(figures.yearRevenuePaise)}
        hint="April to March"
        href="/admin/gst"
      />
      <Tile
        label="Outstanding"
        value={formatRupees(figures.outstandingPaise)}
        tone={figures.outstandingPaise > 0 ? "danger" : "good"}
        hint={
          figures.outstandingCount === 0
            ? "Everything paid"
            : `${figures.outstandingCount} unpaid${
                figures.oldestOwedDays ? `, oldest ${figures.oldestOwedDays} days` : ""
              }`
        }
        href="/admin/outstanding"
      />
      <Tile
        label="Bought this month"
        value={formatRupees(figures.monthPurchasesPaise)}
        hint="Supplier bills"
        href="/admin/purchases"
      />
      <Tile
        label="Customers"
        value={String(figures.customers)}
        hint={`${figures.dealers} dealer${figures.dealers === 1 ? "" : "s"}`}
        href="/admin/customers"
      />
      <Tile
        label="Follow-ups due"
        value={String(figures.followUpsDue)}
        tone={figures.followUpsDue > 0 ? "danger" : undefined}
        hint={figures.followUpsDue > 0 ? "Overdue today" : "Nothing overdue"}
        href="/admin/leads?filter=due"
      />
      <Tile
        label="Needs ordering"
        value={String(figures.reorderCount)}
        tone={figures.reorderCount > 0 ? "danger" : undefined}
        hint={figures.reorderCount > 0 ? "At or below reorder level" : "Stock is fine"}
        href="/admin/stock"
      />
    </div>
  );
}
