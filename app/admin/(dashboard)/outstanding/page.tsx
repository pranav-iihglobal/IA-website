import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { outstandingInvoices, outstandingTotal } from "@/lib/erp/reports";
import type { OutstandingRow, OutstandingSort } from "@/lib/erp/reports";
import { formatINR, formatRupees } from "@/lib/money";
import { paymentReminder, telHref, whatsappHref } from "@/lib/crm/contact-links";
import { EmptyState } from "@/components/admin/ui";

export const metadata = { title: "Outstanding" };
export const dynamic = "force-dynamic";

/**
 * Who owes what.
 *
 * OLDEST FIRST, not largest. An invoice unpaid for four months is a different
 * problem from a big one raised last week, and it is the one that needs the
 * call. Sorting by amount would put the urgent ones out of sight.
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
        <div className="mt-3 flex gap-2">
          <SortLink current={sort} value="oldest" label="Oldest first" />
          <SortLink current={sort} value="largest" label="Biggest first" />
        </div>
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
        <ul className="admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <li
              key={row.invoiceId}
              className="admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
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
                    {/* The record, not the printable document — what is owed
                        on an invoice is a question about its history, and the
                        document cannot answer it. */}
                    <Link href={`/admin/invoices/${row.invoiceId}`} className="hover:underline">
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
              <Chase row={row} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The two taps this screen exists for.
 *
 * A list of who owes money, with no way to reach any of them, is a report
 * rather than a tool. The WhatsApp message names the invoice and the amount
 * because "you owe us money" prompts a call back asking which one — see
 * lib/crm/contact-links.ts.
 *
 * Both are hidden rather than disabled when the stored number is not one this
 * can be confident about: a dead "Call" button is worse than none.
 */
function Chase({ row }: { row: OutstandingRow }) {
  const tel = telHref(row.partyPhone);
  const chat = whatsappHref(
    row.partyPhone,
    paymentReminder({
      name: row.partyName,
      number: row.number,
      amount: formatRupees(row.owedPaise),
    }),
  );
  if (!tel && !chat) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
      {tel && (
        <a
          href={tel}
          className="admin-tap inline-flex items-center rounded-full border border-line px-4 text-xs font-semibold text-ink hover:border-olive"
        >
          Call {row.partyPhone}
        </a>
      )}
      {chat && (
        <a
          href={chat}
          target="_blank"
          rel="noreferrer"
          className="admin-tap inline-flex items-center rounded-full border border-line px-4 text-xs font-semibold text-ink-muted hover:border-olive"
        >
          WhatsApp a reminder
        </a>
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
