import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { betaNote } from "@/lib/auth/permissions";
import { crmOverview } from "@/lib/crm/overview";
import { BetaStar } from "@/components/admin/ui";
import { CountRows, Figure, OverviewCard } from "@/components/admin/Overview";

export const metadata = { title: "Customers overview" };
export const dynamic = "force-dynamic";

/**
 * The sampling programme, as numbers.
 *
 * "Which product do we sample most, and which sampled product converts" is
 * the question the CRM was rebuilt to answer, and until now the only way to
 * ask it was to open leads one by one. Everything here links to the list
 * that shows the rows behind the number — the list header must show the
 * same count, and that equality is the check this page is verified by.
 */
export default async function CrmOverviewPage() {
  await requirePageAccess("crm:read");
  const o = await crmOverview();
  const beta = betaNote("crm");

  const rate = o.sampling.sampled > 0 ? Math.round((o.sampling.converted / o.sampling.sampled) * 100) : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">
          Customers
          {beta && <BetaStar note={beta} className="ml-1.5 align-middle text-base text-alloy" />}
        </h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          Leads, the sample pipeline and where the customers are. Every figure opens
          the list behind it.
          {o.sampleContacts > 0 && (
            <>
              {" "}
              <span className="text-cta">{o.sampleContacts} demo contacts are not counted.</span>
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="admin-card p-4">
          <Figure label="Leads" value={String(o.leads.total)} href="/admin/leads" />
        </div>
        <div className="admin-card p-4">
          <Figure
            label="Follow-ups overdue"
            value={String(o.followUps.overdue)}
            tone={o.followUps.overdue > 0 ? "danger" : undefined}
            href="/admin/leads?filter=due"
          />
        </div>
        <div className="admin-card p-4">
          <Figure
            label={`New in ${o.monthLabel.split(" ")[0]}`}
            value={String(o.newThisMonth.leads + o.newThisMonth.customers)}
            hint={`${o.newThisMonth.leads} leads, ${o.newThisMonth.customers} customers · last month ${o.newLastMonth.leads + o.newLastMonth.customers}`}
            href="/admin/leads?sort=newest"
          />
        </div>
        <div className="admin-card p-4">
          <Figure
            label="Sampled → bought"
            value={rate === null ? "—" : `${rate}%`}
            hint={`${o.sampling.converted} of ${o.sampling.sampled} sampled leads became customers`}
            tone={rate !== null && rate >= 30 ? "good" : undefined}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewCard title="Leads by stage" href="/admin/leads">
          <CountRows rows={o.leads.byStage} />
        </OverviewCard>

        <OverviewCard
          title="Customers by standing"
          href="/admin/customers"
          hint={`${o.customers.total} customers and dealers`}
        >
          <CountRows
            rows={o.customers.byStatus}
            tone={(key) => (key === "at_risk" || key === "dormant" ? "danger" : undefined)}
          />
        </OverviewCard>

        <OverviewCard
          title="Sampled, and who bought"
          hint="A lead counts as converted once it is a customer"
        >
          {o.sampling.byProduct.length === 0 ? (
            <p className="text-sm text-ink-muted">
              No lead carries a sampled product yet. Pick them on the lead&rsquo;s Sample step.
            </p>
          ) : (
            <CountRows
              rows={o.sampling.byProduct.map((p) => ({
                key: p.productId,
                label: p.name,
                count: p.sampled,
                extra: `${p.converted} bought`,
                href: "/admin/leads",
              }))}
            />
          )}
        </OverviewCard>

        <OverviewCard title="Follow-ups overdue, by owner" href="/admin/leads?filter=due">
          {o.followUps.byOwner.length === 0 ? (
            <p className="text-sm text-olive">Nothing overdue.</p>
          ) : (
            <CountRows rows={o.followUps.byOwner} tone={() => "danger"} />
          )}
        </OverviewCard>

        <OverviewCard title="By district" hint="Top ten, customers first" href="/admin/customers?sort=district">
          {o.districts.length === 0 ? (
            <p className="text-sm text-ink-muted">No district recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {o.districts.map((d) => (
                <li key={d.district} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <Link
                    href={`/admin/customers?q=${encodeURIComponent(d.district)}`}
                    className="min-w-0 truncate text-ink hover:text-cta hover:underline"
                  >
                    {d.district}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-soft">
                    <span className="font-bold text-ink-strong">{d.customers}</span> customers ·{" "}
                    <Link href={`/admin/leads?q=${encodeURIComponent(d.district)}`} className="hover:text-cta hover:underline">
                      {d.leads} leads
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </OverviewCard>
      </div>
    </div>
  );
}
