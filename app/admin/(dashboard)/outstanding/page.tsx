import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { outstandingInvoices, outstandingTotal } from "@/lib/erp/reports";
import type { OutstandingSort } from "@/lib/erp/reports";
import { formatRupees } from "@/lib/money";
import { groupByParty, summariseAgeing } from "@/lib/erp/ageing";
import { DownloadLink, EmptyState } from "@/components/admin/ui";
import { OutstandingList } from "@/components/admin/OutstandingList";
import { AgeingBands } from "@/components/admin/AgeingBands";
import { DebtorCards } from "@/components/admin/DebtorCards";

export const metadata = { title: "Outstanding" };
export const dynamic = "force-dynamic";

/**
 * Who owes what.
 *
 * OLDEST FIRST, not largest. An invoice unpaid for four months is a different
 * problem from a big one raised last week, and it is the one that needs the
 * call. Sorting by amount would put the urgent ones out of sight.
 *
 * THREE READINGS OF THE SAME DEBT, because the screen was asked three
 * different questions and could only answer one:
 *
 *   Ageing — how much of what we are owed is genuinely stuck. A flat list of
 *   invoices with "84 days old" on each cannot be added up by eye.
 *
 *   By customer — four unpaid invoices to one farmer is ONE phone call, and
 *   the flat list showed four rows and no total for them.
 *
 *   By invoice — what was already there, and still the default, because it is
 *   the one that says which document to talk about.
 */
export default async function OutstandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("billing:read");

  // In the URL, so "show me the biggest" is a link somebody can send.
  const url = await searchParams;
  const sort: OutstandingSort = url.sort === "largest" ? "largest" : "oldest";
  /*
    The total comes from an aggregation over EVERY unpaid invoice, not from
    summing the rows below — those are capped for the screen, and a capped sum
    would be quietly low.
  */
  const [rows, total] = await Promise.all([
    outstandingInvoices(sort),
    outstandingTotal(),
  ]);
  const capped = total.count > rows.length;
  /*
    Both breakdowns come from the ROWS, not from a second aggregation, and the
    screen says so when the rows are capped. A banded total that silently
    disagreed with the headline figure beside it would be worse than not
    showing one — see the same argument on outstandingTotal().
  */
  const ageing = summariseAgeing(rows);
  const parties = groupByParty(rows);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong">Outstanding</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          {total.count} invoice{total.count === 1 ? "" : "s"} unpaid,{" "}
          <strong className={total.owedPaise > 0 ? "text-danger" : ""}>
            {formatRupees(total.owedPaise)}
          </strong>{" "}
          owed. {sort === "largest" ? "Biggest first." : "Oldest first."}
          {capped &&
            ` Showing the ${sort === "largest" ? "largest" : "oldest"} ${rows.length}.`}
        </p>

        {/*
          Two orders, because they answer different questions: oldest first is
          "who do I ring", biggest first is "where is the money". Oldest stays
          the default — the four-month-old invoice is the one that needs the
          call, and sorting by amount would put it out of sight.
        */}
        <div className="mt-3 flex flex-wrap gap-2">
          <SortLink current={sort} value="oldest" label="Oldest first" />
          <SortLink current={sort} value="largest" label="Biggest first" />
          {/* Every unpaid invoice in this order, not just the 500 shown. */}
          <DownloadLink href={`/api/admin/outstanding?sort=${sort}&format=csv`} />
        </div>
      </div>

      {rows.length > 0 && (
        <section className="admin-card p-4">
          <h2 className="font-display text-base font-bold text-ink-strong">
            How overdue it is
          </h2>
          <div className="mt-3">
            <AgeingBands
              totals={ageing}
              note={capped ? `Across the ${rows.length} shown, not all ${total.count}.` : undefined}
            />
          </div>
        </section>
      )}

      {/* ---------- By customer ---------- */}
      {parties.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink-strong">
              By customer
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Biggest first. Four unpaid invoices to one farmer is one phone
              call; the list below shows them as four documents.
            </p>
          </div>
          <DebtorCards parties={parties} />
        </section>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Nothing owed" message="Every issued invoice is paid in full." />
      ) : (
        /* Cards, or a table from lg — remembered on this device. */
        <OutstandingList rows={rows} />
      )}
    </div>
  );
}

function SortLink({
  current,
  value,
  label,
}: {
  current: OutstandingSort;
  value: OutstandingSort;
  label: string;
}) {
  const active = current === value;
  return (
    <Link
      href={value === "oldest" ? "/admin/outstanding" : `/admin/outstanding?sort=${value}`}
      aria-current={active ? "true" : undefined}
      className={`admin-tap inline-flex items-center rounded-full border px-4 text-xs font-semibold ${
        active
          ? "border-olive bg-accent-soft text-ink-strong"
          : "border-line text-ink-muted hover:border-olive hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}
