import Link from "next/link";
import type { ReactNode } from "react";
import { OverviewCard } from "./Overview";
import { AgeingBands } from "./AgeingBands";
import { FunnelRows, MonthBars, PairedBars } from "./Charts";
import { formatRupees } from "@/lib/money";
import type { DashboardData } from "@/lib/admin/dashboard";

/**
 * The dashboard's cards — the money and its four charts, the customers,
 * the operations, and one for the site.
 *
 * The Today panel went: its follow-ups list lives on Leads (`?filter=due`)
 * and the Customers card keeps the count; what the directors asked for
 * instead was the SHAPE of the business — twelve months of sales, the
 * products this month against last, the debt by age, the lead funnel — in
 * plain SVG and CSS. Every line is a link to the filtered, sorted list that
 * explains it, every "this month" names the month, and colour appears only
 * where the figure means act: money past 60 days, calls overdue, stock to
 * reorder. One column on a phone, two from md.
 *
 * A plain module, like Overview.tsx: server pages compose it and read
 * nothing across a client boundary.
 */

const OVERDUE_DAYS = 60;

export function DashboardCards({
  data,
  beta,
  canNewProduct,
}: {
  data: DashboardData;
  beta: { crm: string | null; billing: string | null };
  canNewProduct: boolean;
}) {
  const { money, customers, operations, content } = data;
  return (
    <div className="space-y-4">
      <SampleNotice sample={data.sample} />

      {money && (
        <OverviewCard title="Money" href="/admin/sales" beta={beta.billing} hint={money.monthLabel}>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <ul className="divide-y divide-line-soft">
              <Line
                label={`Sales in ${money.monthLabel}`}
                value={formatRupees(money.revenuePaise)}
                hint={
                  money.change ??
                  `${money.invoices} invoice${money.invoices === 1 ? "" : "s"}`
                }
                href="/admin/invoices?sort=newest"
              />
              <Line
                label="Outstanding"
                value={formatRupees(money.outstandingPaise)}
                hint={
                  money.outstandingCount === 0
                    ? "Everything paid"
                    : `${money.outstandingCount} unpaid${
                        money.oldestOwedDays !== null ? `, oldest ${money.oldestOwedDays} days` : ""
                      }`
                }
                href="/admin/outstanding?sort=largest"
                tone={
                  money.outstandingPaise > 0 && (money.oldestOwedDays ?? 0) > OVERDUE_DAYS
                    ? "danger"
                    : undefined
                }
              />
              <Line
                label={`GST due for ${money.monthLabel}`}
                value={formatRupees(money.gstNetPaise)}
                hint={`${formatRupees(money.gstOutputPaise)} charged, ${formatRupees(
                  money.gstInputCreditPaise,
                )} input credit`}
                href="/admin/gst"
              />
              <Line
                label={money.fyLabel}
                value={formatRupees(money.fyPaise)}
                hint="April to date"
                href="/admin/sales"
              />
            </ul>
            <MonthBars months={money.months} />
          </div>
        </OverviewCard>
      )}

      {money && (
        <div className="grid gap-4 md:grid-cols-2">
          <OverviewCard
            title="Sales by product"
            href="/admin/invoices?sort=newest"
            hint={`${money.monthLabel} against ${money.lastMonthLabel}`}
          >
            <PairedBars rows={money.products} thisLabel={money.monthLabel} lastLabel={money.lastMonthLabel} />
          </OverviewCard>
          <OverviewCard title="Outstanding by age" href="/admin/outstanding" hint="Every unpaid invoice">
            <AgeingBands totals={money.ageing} compact />
          </OverviewCard>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {customers && (
          <OverviewCard title="Leads funnel" href="/admin/crm" beta={beta.crm} hint={`${customers.leads} leads`}>
            <FunnelRows rows={customers.funnel} />
          </OverviewCard>
        )}
        {customers && (
          <OverviewCard title="Customers" href="/admin/crm" beta={beta.crm}>
            <ul className="divide-y divide-line-soft">
              <Line label="Customers" value={String(customers.customers)} href="/admin/customers" />
              <Line label="Dealers" value={String(customers.dealers)} href="/admin/dealers" />
              <Line
                label="Leads"
                value={String(customers.leads)}
                hint={`${customers.newThisMonth} new in ${data.monthLabel}`}
                href="/admin/leads?sort=newest"
              />
              <Line
                label="Follow-ups due"
                value={String(customers.followUpsDue)}
                hint={customers.followUpsDue > 0 ? "Overdue — ring them" : "Nothing overdue"}
                href="/admin/leads?filter=due"
                tone={customers.followUpsDue > 0 ? "danger" : undefined}
              />
            </ul>
          </OverviewCard>
        )}

      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {operations && (
          <OverviewCard title="Operations" href="/admin/stock" beta={beta.billing}>
            <ul className="divide-y divide-line-soft">
              <Line
                label="Needs ordering"
                value={String(operations.reorders)}
                hint={operations.reorders > 0 ? "At or below reorder level" : "Stock is fine"}
                href="/admin/stock?filter=low"
                tone={operations.reorders > 0 ? "danger" : undefined}
              />
              <Line
                label={`Bought in ${operations.monthLabel}`}
                value={formatRupees(operations.purchasesMonthPaise)}
                hint={`${operations.purchasesMonthCount} supplier bill${
                  operations.purchasesMonthCount === 1 ? "" : "s"
                }`}
                href="/admin/purchases"
              />
              <Line
                label="Supplier bills unpaid"
                value={formatRupees(operations.unpaidBillsPaise)}
                hint={
                  operations.unpaidBills === 0
                    ? "All settled"
                    : `${operations.unpaidBills} bill${operations.unpaidBills === 1 ? "" : "s"}`
                }
                href="/admin/purchases?filter=unpaid"
              />
            </ul>
          </OverviewCard>
        )}

      {content && (
        <OverviewCard title="Content" hint="The public site">
          <ul className="divide-y divide-line-soft">
            {content.products && (
              <ContentLine
                label="Products"
                {...content.products}
                href="/admin/products"
                draftsHref="/admin/products?status=draft"
              />
            )}
            {content.testimonials && (
              <ContentLine
                label="Testimonials"
                {...content.testimonials}
                href="/admin/testimonials"
                draftsHref="/admin/testimonials?status=draft"
              />
            )}
            {content.posts && (
              <ContentLine
                label="Blog posts"
                {...content.posts}
                draftLabel="draft or scheduled"
                href="/admin/blog"
                draftsHref="/admin/blog?status=draft"
              />
            )}
          </ul>
          {canNewProduct && (
            <div className="mt-3 border-t border-line-soft pt-3">
              <Link
                href="/admin/products/new"
                className="admin-btn admin-tap inline-flex border border-line bg-raised/70 text-ink hover:border-olive"
              >
                New product
              </Link>
            </div>
          )}
        </OverviewCard>
      )}
      </div>
    </div>
  );
}

/**
 * One line: label and hint on the left, the figure on the right, the whole
 * row a link. Red only when `tone` says the figure means act.
 */
function Line({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  href: string;
  tone?: "danger";
}) {
  return (
    <li>
      <Link
        href={href}
        className="admin-tap -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"
      >
        <span className="min-w-0">
          <span className="block text-sm text-ink">{label}</span>
          {hint && <span className="block text-xs text-ink-soft">{hint}</span>}
        </span>
        <span
          className={`shrink-0 font-display text-lg font-bold tabular-nums ${
            tone === "danger" ? "text-danger" : "text-ink-strong"
          }`}
        >
          {value}
        </span>
      </Link>
    </li>
  );
}

/** Published count, and the drafts as the only bold figure — they are the work. */
function ContentLine({
  label,
  published,
  drafts,
  draftLabel = "drafts",
  href,
  draftsHref,
}: {
  label: string;
  published: number;
  drafts: number;
  draftLabel?: string;
  href: string;
  draftsHref: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <Link href={href} className="admin-tap -mx-2 flex min-w-0 flex-col justify-center rounded-xl px-2 hover:bg-surface-muted">
        <span className="block text-sm text-ink">{label}</span>
        <span className="block text-xs text-ink-soft">{published} published</span>
      </Link>
      {drafts > 0 ? (
        <Link
          href={draftsHref}
          className="admin-tap shrink-0 whitespace-nowrap rounded-full px-2 font-display text-lg font-bold tabular-nums text-cta hover:bg-surface-muted"
        >
          {drafts}
          <span className="ml-1 text-xs font-semibold">
            {drafts === 1 ? draftLabel.replace(/^drafts$/, "draft") : draftLabel}
          </span>
        </Link>
      ) : (
        <span className="shrink-0 text-xs text-ink-faint">no {draftLabel}</span>
      )}
    </li>
  );
}

/**
 * One honest line while seeded records exist. The Beta stars say a module is
 * unfinished; nothing said the numbers were made up — and the figures above
 * now leave the seeded records OUT, so the line explains the difference
 * between the dashboard and a list that still shows them.
 */
function SampleNotice({ sample }: { sample: DashboardData["sample"] }) {
  const parts = [
    sample.invoices > 0 && `${sample.invoices} invoice${sample.invoices === 1 ? "" : "s"}`,
    sample.contacts > 0 && `${sample.contacts} contact${sample.contacts === 1 ? "" : "s"}`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-ink-soft">
      Demo data on the cluster: {parts.join(" and ")}. Not counted in any figure here.
    </p>
  );
}

/** The cards' own shape, so the page does not jump when the figures land. */
export function CardsSkeleton(): ReactNode {
  const card = (rows: number, key: string, bars = false) => (
    <div key={key} className="admin-card p-4" aria-hidden="true">
      <div className="admin-skeleton h-4 w-24 rounded" />
      {/* The Money card's bars, so the tallest card is the right height too. */}
      {bars && <div className="admin-skeleton mt-3 h-20 w-full rounded md:hidden" />}
      <div className="mt-3 divide-y divide-line-soft">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2.5">
            <div className="space-y-1.5">
              <div className="admin-skeleton h-3.5 w-32 rounded" />
              <div className="admin-skeleton h-3 w-20 rounded" />
            </div>
            <div className="admin-skeleton h-5 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4">
      {card(4, "money", true)}
      <div className="grid gap-4 md:grid-cols-2">
        {card(3, "products")}
        {card(2, "ageing")}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {card(5, "funnel")}
        {card(4, "customers")}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {card(3, "operations")}
        {card(3, "content")}
      </div>
    </div>
  );
}
