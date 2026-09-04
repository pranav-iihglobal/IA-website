import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { betaNote } from "@/lib/auth/permissions";
import { salesOverview } from "@/lib/erp/overview";
import { AgeingBands } from "@/components/admin/AgeingBands";
import { formatRupees } from "@/lib/money";
import { BetaStar } from "@/components/admin/ui";
import { CountRows, Figure, OverviewCard } from "@/components/admin/Overview";

export const metadata = { title: "Sales overview" };
export const dynamic = "force-dynamic";

/** "up 24%" / "down 8%" / null when there is nothing to compare against. */
function change(now: number, before: number): string | null {
  if (before <= 0) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return "level";
  return `${pct > 0 ? "up" : "down"} ${Math.abs(pct)}%`;
}

/**
 * The monthly conversation with the CA, on one page.
 *
 * Half of this was scattered across the dashboard, Outstanding and
 * Purchases; the other half — the same month last year, GST charged against
 * input credit, purchases by category — was nowhere. Every figure links to
 * the list behind it, and the outstanding bands are over EVERY unpaid
 * invoice rather than the screen's capped 500, so they sum to the total.
 */
export default async function SalesOverviewPage() {
  await requirePageAccess("billing:read");
  const o = await salesOverview();
  const beta = betaNote("billing");
  const r = o.revenue;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">
          Sales
          {beta && <BetaStar note={beta} className="ml-1.5 align-middle text-base text-alloy" />}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {o.windows.thisMonth}. Every figure opens the list behind it.
          {o.sampleInvoices > 0 && (
            <>
              {" "}
              <span className="text-cta">{o.sampleInvoices} demo invoices are not counted.</span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="admin-card p-4">
          <Figure
            label={r.thisMonth.label}
            value={formatRupees(r.thisMonth.paise)}
            hint={[
              `${r.thisMonth.count} invoice${r.thisMonth.count === 1 ? "" : "s"}`,
              change(r.thisMonth.paise, r.lastMonth.paise) &&
                `${change(r.thisMonth.paise, r.lastMonth.paise)} on ${r.lastMonth.label.split(" ")[0]}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            href="/admin/invoices"
          />
        </div>
        <div className="admin-card p-4">
          <Figure
            label={r.sameMonthLastYear.label}
            value={formatRupees(r.sameMonthLastYear.paise)}
            hint={change(r.thisMonth.paise, r.sameMonthLastYear.paise) ? `this year ${change(r.thisMonth.paise, r.sameMonthLastYear.paise)}` : "nothing to compare"}
            href="/admin/invoices?sort=oldest"
          />
        </div>
        <div className="admin-card p-4">
          <Figure label={r.fy.label} value={formatRupees(r.fy.paise)} hint={`${r.fy.count} invoices since April`} href="/admin/invoices" />
        </div>
        <div className="admin-card p-4">
          <Figure
            label="Outstanding"
            value={formatRupees(o.outstanding.totalPaise)}
            hint={`${o.outstanding.count} unpaid invoice${o.outstanding.count === 1 ? "" : "s"}`}
            tone={o.outstanding.ageing.d61_90 + o.outstanding.ageing.d90_plus > 0 ? "danger" : undefined}
            href="/admin/outstanding?sort=largest"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewCard title="How overdue it is" href="/admin/outstanding" hint="Across every unpaid invoice">
          <AgeingBands totals={o.outstanding.ageing} compact />
        </OverviewCard>

        <OverviewCard title="Who owes the most" href="/admin/outstanding?sort=largest">
          {o.outstanding.topDebtors.length === 0 ? (
            <p className="text-sm text-olive">Nothing owed.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {o.outstanding.topDebtors.map((d) => (
                <li key={d.contactId ?? d.name} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  {d.contactId ? (
                    <Link href={`/admin/outstanding/${d.contactId}`} className="min-w-0 truncate text-ink hover:text-cta hover:underline">
                      {d.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate text-ink">{d.name}</span>
                  )}
                  <span className="shrink-0 tabular-nums">
                    <span className={`font-bold ${d.oldestDays > 60 ? "text-danger" : "text-ink-strong"}`}>
                      {formatRupees(d.owedPaise)}
                    </span>
                    <span className="ml-1.5 text-xs text-ink-soft">
                      {d.invoices} bill{d.invoices === 1 ? "" : "s"}, oldest {d.oldestDays}d
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>

        <OverviewCard title={`GST, ${o.windows.thisMonth}`} href="/admin/gst" hint="Charged on sales against claimable on purchases">
          <div className="grid grid-cols-3 gap-3">
            <Figure label="Charged" value={formatRupees(o.gst.outputPaise)} href="/admin/gst" />
            <Figure label="Input credit" value={formatRupees(o.gst.inputCreditPaise)} href="/admin/purchases?filter=credit" />
            <Figure
              label={o.gst.netPaise >= 0 ? "Net payable" : "Net credit"}
              value={formatRupees(Math.abs(o.gst.netPaise))}
              tone={o.gst.netPaise < 0 ? "good" : undefined}
            />
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            Indicative. The return the CA files is the GST page; this is the two sides of it beside each other.
          </p>
        </OverviewCard>

        <OverviewCard
          title={`Purchases, ${o.windows.thisMonth}`}
          href="/admin/purchases"
          hint={`${o.purchases.count} bill${o.purchases.count === 1 ? "" : "s"}, ${formatRupees(o.purchases.totalPaise)}`}
        >
          {o.purchases.byCategory.length === 0 ? (
            <p className="text-sm text-ink-muted">No bills entered this month.</p>
          ) : (
            <CountRows
              rows={o.purchases.byCategory.map((c) => ({
                key: c.key,
                label: c.label,
                count: Math.round(c.paise / 100),
                extra: `${c.count} bill${c.count === 1 ? "" : "s"}`,
                href: `/admin/purchases?filter=${c.key}`,
              }))}
            />
          )}
          {o.purchases.owedToDirectorsPaise > 0 && (
            <p className="mt-3 text-sm">
              <Link href="/admin/purchases?filter=director" className="font-semibold text-cta hover:underline">
                {formatRupees(o.purchases.owedToDirectorsPaise)} paid by directors, owed back
              </Link>
              <span className="text-xs text-ink-faint"> · all time</span>
            </p>
          )}
        </OverviewCard>

        <OverviewCard title={`Credit notes, ${o.windows.thisMonth}`} href="/admin/invoices?filter=credit_notes">
          <Figure
            label="Raised"
            value={String(o.creditNotes.count)}
            hint={o.creditNotes.count > 0 ? `${formatRupees(o.creditNotes.paise)} reversed` : "none this month"}
            href="/admin/invoices?filter=credit_notes"
          />
        </OverviewCard>
      </div>
    </div>
  );
}
