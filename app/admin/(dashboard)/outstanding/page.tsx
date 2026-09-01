import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { outstandingInvoices, outstandingTotal } from "@/lib/erp/reports";
import { formatINR, formatRupees } from "@/lib/money";
import { EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/**
 * Who owes what.
 *
 * OLDEST FIRST, not largest. An invoice unpaid for four months is a different
 * problem from a big one raised last week, and it is the one that needs the
 * call. Sorting by amount would put the urgent ones out of sight.
 */
export default async function OutstandingPage() {
  await requirePageAccess("billing:read");
  /*
    The total comes from an aggregation over EVERY unpaid invoice, not from
    summing the rows below — those are capped for the screen, and a capped sum
    would be quietly low.
  */
  const [rows, total] = await Promise.all([
    outstandingInvoices(),
    outstandingTotal(),
  ]);
  const overdue = rows.filter((r) => r.daysOld > 30);
  const capped = total.count > rows.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong">Outstanding</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {total.count} invoice{total.count === 1 ? "" : "s"} unpaid,{" "}
          <strong className={total.owedPaise > 0 ? "text-danger" : ""}>
            {formatRupees(total.owedPaise)}
          </strong>{" "}
          owed. Oldest first.
          {capped && ` Showing the oldest ${rows.length}.`}
        </p>
      </div>

      {overdue.length > 0 && (
        <p className="admin-card px-4 py-2.5 text-sm text-ink">
          <strong className="font-semibold">{overdue.length}</strong> older than 30
          days, {formatRupees(overdue.reduce((t, r) => t + r.owedPaise, 0))} of the
          total.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Nothing owed" message="Every issued invoice is paid in full." />
      ) : (
        <ul className="admin-rows grid gap-3">
          {rows.map((row) => (
            <li
              key={row.invoiceId}
              className="admin-card-item admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-strong">
                    {row.contactId ? (
                      <Link href={`/admin/contacts/${row.contactId}`} className="hover:underline">
                        {row.partyName}
                      </Link>
                    ) : (
                      row.partyName
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    <Link href={`/admin/invoices/${row.invoiceId}/print`} className="hover:underline">
                      {row.number}
                    </Link>
                    {" · "}
                    <span className={row.daysOld > 30 ? "font-semibold text-danger" : ""}>
                      {row.daysOld} days old
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold tabular-nums text-danger">
                    {formatINR(row.owedPaise)}
                  </p>
                  {row.paidPaise > 0 && (
                    <p className="text-xs text-ink-faint">
                      {formatINR(row.paidPaise)} of {formatINR(row.grandTotalPaise)} paid
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
