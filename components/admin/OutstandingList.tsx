"use client";

import Link from "next/link";
import { ListCard, ViewToggle } from "./ui";
import { useViewMode } from "./useViewMode";
import { formatINR, formatRupees } from "@/lib/money";
import { paymentReminder, telHref, whatsappHref } from "@/lib/crm/contact-links";
import type { OutstandingRow } from "@/lib/erp/reports";

/**
 * The invoice-by-invoice half of the Outstanding page, as cards or a table.
 *
 * Split out of the page because the choice is remembered on the device
 * (useViewMode) and the page is a server component. The ageing bands and
 * the by-customer list above it stay on the server; only this list has
 * enough rows for a table to matter.
 */
export function OutstandingList({ rows }: { rows: OutstandingRow[] }) {
  const [view, setView] = useViewMode("outstanding");

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink-strong">By invoice</h2>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <ul
        className={`admin-rows grid gap-3 sm:grid-cols-2 2xl:grid-cols-3 ${
          view === "table" ? "lg:hidden" : ""
        }`}
      >
        {rows.map((row) => (
          <ListCard
            key={row.invoiceId}
            title={<PartyLink row={row} />}
            subtitle={
              <>
                {/* The record, not the printable document — what is owed
                    on an invoice is a question about its history, and the
                    document cannot answer it. */}
                <Link href={`/admin/invoices/${row.invoiceId}`} className="hover:underline">
                  {row.number}
                </Link>
                {" · "}
                <Age row={row} />
              </>
            }
            figure={formatINR(row.owedPaise)}
            figureTone="danger"
            figureNote={
              row.paidPaise > 0 || row.creditedPaise > 0
                ? `of ${formatINR(row.grandTotalPaise)}${row.paidPaise > 0 ? `, ${formatINR(row.paidPaise)} paid` : ""}${
                    row.creditedPaise > 0 ? `, ${formatINR(row.creditedPaise)} credited` : ""
                  }`
                : undefined
            }
            meta={row.partyPhone}
            actions={<Chase row={row} />}
          />
        ))}
      </ul>

      {view === "table" && <OutstandingTable rows={rows} />}
    </section>
  );
}

function PartyLink({ row }: { row: OutstandingRow }) {
  return row.contactId ? (
    <Link href={`/admin/contacts/${row.contactId}`} className="hover:underline">
      {row.partyName}
    </Link>
  ) : (
    <>{row.partyName}</>
  );
}

function Age({ row }: { row: OutstandingRow }) {
  return (
    <span className={row.daysOld > 30 ? "font-semibold text-danger" : ""}>
      {row.daysOld} days old
    </span>
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

  const pill =
    "admin-tap inline-flex items-center rounded-full border border-line px-3.5 text-xs font-semibold text-ink hover:border-olive";
  return (
    <>
      {tel && (
        <a href={tel} aria-label={`Call ${row.partyName} on ${row.partyPhone}`} className={pill}>
          Call
        </a>
      )}
      {chat && (
        <a href={chat} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${row.partyName} a reminder`} className={pill}>
          WhatsApp reminder
        </a>
      )}
    </>
  );
}

/** The same rows as a table, from `lg` up. Money in columns, oldest still first. */
function OutstandingTable({ rows }: { rows: OutstandingRow[] }) {
  const th = "px-4 py-3 font-semibold";
  const td = "px-4 py-2.5 align-top";
  const num = `${td} whitespace-nowrap text-right tabular-nums`;
  return (
    <div className="admin-card hidden overflow-hidden lg:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="admin-section-head text-[11px] uppercase tracking-[0.12em] text-accent">
            <tr>
              <th className={th}>Customer</th>
              <th className={th}>Invoice</th>
              <th className={th}>Age</th>
              <th className={`${th} text-right`}>Invoiced</th>
              <th className={`${th} text-right`}>Paid</th>
              <th className={`${th} text-right`}>Credited</th>
              <th className={`${th} text-right`}>Owed</th>
              <th className={`${th} text-right`}>
                <span className="sr-only">Chase</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.invoiceId} className="admin-row border-t border-line-soft/25">
                <td className={`${td} max-w-[16rem] truncate font-semibold text-ink-strong`}>
                  <PartyLink row={row} />
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <Link href={`/admin/invoices/${row.invoiceId}`} className="hover:underline">
                    {row.number}
                  </Link>
                </td>
                <td className={`${td} whitespace-nowrap`}>
                  <Age row={row} />
                </td>
                <td className={`${num} text-ink-muted`}>{formatINR(row.grandTotalPaise)}</td>
                <td className={`${num} text-ink-muted`}>
                  {row.paidPaise > 0 ? formatINR(row.paidPaise) : "—"}
                </td>
                <td className={`${num} text-ink-muted`}>
                  {row.creditedPaise > 0 ? formatINR(row.creditedPaise) : "—"}
                </td>
                <td className={`${num} font-semibold text-danger`}>{formatINR(row.owedPaise)}</td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <span className="inline-flex flex-wrap justify-end gap-1.5">
                    <Chase row={row} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
