import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { outstandingInvoices } from "@/lib/erp/reports";
import { AGE_BUCKETS, summariseAgeing } from "@/lib/erp/ageing";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import { paymentReminder, telHref, whatsappHref } from "@/lib/crm/contact-links";
import { EmptyState, StatusPill } from "@/components/admin/ui";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Outstanding — customer" };
export const dynamic = "force-dynamic";

/**
 * Everything one customer owes.
 *
 * The flat list is the right default — it says which document to talk about —
 * but it cannot prepare a phone call. Four unpaid invoices to one farmer show
 * as four rows with no total, no sense of how far back they go, and the
 * reminder message on each one naming only that invoice.
 *
 * This is the screen for the call: one total, how overdue it is, every unpaid
 * document listed, and a WhatsApp reminder that names the WHOLE debt rather
 * than one line of it.
 */
export default async function PartyOutstandingPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const me = await requirePageAccess("billing:read");

  const { contactId } = await params;
  if (!isValidObjectId(contactId)) notFound();

  await connectToDatabase();
  const [rows, contact] = await Promise.all([
    outstandingInvoices("oldest", contactId),
    Contact.findById(contactId)
      .select("name businessName phone village district contactId kind channel")
      .lean() as Promise<LeanDoc | null>,
  ]);

  // A contact that has been deleted since the invoices were raised still has
  // debts; the invoices carry their own party snapshot, so the page works.
  if (!contact && rows.length === 0) notFound();

  const name =
    contact?.businessName ||
    contact?.name ||
    rows[0]?.partyName ||
    "This customer";
  const phone = contact?.phone || rows.find((r) => r.partyPhone)?.partyPhone || "";
  const owedPaise = rows.reduce((total, row) => total + row.owedPaise, 0);
  const ageing = summariseAgeing(rows);
  const oldest = rows.reduce((max, row) => Math.max(max, row.daysOld), 0);

  const tel = telHref(phone);
  /*
    The reminder names the TOTAL and how many documents it covers, not one
    invoice. Sending "invoice IA.09.26.014 for ₹4,250" to somebody who owes
    ₹19,000 across four bills invites paying that one and stopping.
  */
  const chat = whatsappHref(
    phone,
    paymentReminder({
      name,
      number:
        rows.length === 1
          ? rows[0].number
          : `${rows.length} bills (${rows.map((r) => r.number).join(", ")})`,
      amount: formatRupees(owedPaise),
    }),
  );

  return (
    <div className="space-y-5">
      <Link
        href="/admin/outstanding"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← Outstanding
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            {contact ? (
              <Link href={`/admin/contacts/${contactId}`} className="hover:underline">
                {name}
              </Link>
            ) : (
              name
            )}
          </h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {rows.length} unpaid invoice{rows.length === 1 ? "" : "s"},{" "}
            <strong className={owedPaise > 0 ? "text-danger" : ""}>
              {formatRupees(owedPaise)}
            </strong>{" "}
            owed
            {oldest > 0 ? `, oldest ${oldest} days` : ""}.
          </p>
          {!contact && (
            <p className="mt-1 text-xs text-ink-faint">
              The customer record has been deleted. These invoices carry their
              own copy of the party, so they still read correctly.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={tel} className="admin-btn admin-btn-primary admin-tap">
              Call {phone}
            </a>
          )}
          {chat && owedPaise > 0 && (
            <a
              href={chat}
              target="_blank"
              rel="noreferrer"
              className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive"
            >
              WhatsApp the total
            </a>
          )}
        </div>
      </header>

      {rows.length === 0 ? (
        <EmptyState
          title="Nothing owed"
          message="Every invoice raised against this customer is paid in full."
        />
      ) : (
        <>
          <section className="admin-card p-4">
            <h2 className="font-display text-base font-bold text-ink-strong">
              How overdue it is
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {AGE_BUCKETS.map((bucket) => (
                <div key={bucket.key} className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                    {bucket.label}
                  </p>
                  <p
                    className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
                      (bucket.key === "d61_90" || bucket.key === "d90_plus") &&
                      ageing[bucket.key] > 0
                        ? "text-danger"
                        : "text-ink-strong"
                    }`}
                  >
                    {formatRupees(ageing[bucket.key])}
                  </p>
                  <p className="text-xs text-ink-faint">{bucket.hint}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-card p-4">
            <h2 className="font-display text-base font-bold text-ink-strong">
              The invoices
            </h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Oldest first — the one that has waited longest is the one to
              raise on the call.
            </p>
            <ul className="mt-3 divide-y divide-line-soft">
              {rows.map((row) => (
                <li
                  key={row.invoiceId}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
                >
                  <Link
                    href={`/admin/invoices/${row.invoiceId}`}
                    className="text-sm font-semibold text-ink-strong hover:text-cta hover:underline"
                  >
                    {row.number}
                  </Link>
                  {row.paidPaise > 0 && <StatusPill status="partial" />}
                  <span className="min-w-0 flex-1 text-xs text-ink-faint">
                    {row.issuedAt
                      ? formatIstDateLong(new Date(row.issuedAt))
                      : "not issued"}{" "}
                    · {row.daysOld} days
                    {(row.paidPaise > 0 || row.creditedPaise > 0) &&
                      ` · ${formatINR(row.grandTotalPaise)} invoiced`}
                    {row.paidPaise > 0 && `, ${formatINR(row.paidPaise)} paid`}
                    {row.creditedPaise > 0 && `, ${formatINR(row.creditedPaise)} credited`}
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      row.daysOld > 60 ? "text-danger" : "text-ink-strong"
                    }`}
                  >
                    {formatINR(row.owedPaise)}
                  </span>
                  {can(me, "billing:write") && (
                    <Link
                      href={`/admin/invoices/${row.invoiceId}/payment`}
                      className="admin-tap inline-flex items-center rounded-full border border-line px-3 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Payment
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
