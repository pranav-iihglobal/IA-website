import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { getInvoiceDetail } from "@/lib/erp/invoice-detail";
import { recordHistory } from "@/lib/admin/history";
import { RecordHistory } from "@/components/admin/RecordHistory";
import { RecordHeader, StatusPill } from "@/components/admin/ui";
import { formatINR, formatRupees } from "@/lib/money";
import { formatRate } from "@/lib/erp/tax";
import { formatIstDateLong } from "@/lib/time";
import { paymentReminder, telHref, whatsappHref } from "@/lib/crm/contact-links";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

/**
 * One invoice, in full.
 *
 * There was no such screen. A row in the list showed a number, a party and a
 * total; the print view showed the document. Between them they could not
 * answer the questions that actually come up about an invoice that has been
 * out for a few weeks — how much of it has been credited, which notes those
 * were, what is genuinely still owed, and who touched it.
 *
 * NOTHING HERE IS EDITABLE, and the page says so. An issued invoice is a
 * record of what was filed; the model refuses a financial change to one
 * regardless of what any screen asks for. What it offers instead are the four
 * things that ARE legitimate: print it, record a payment, credit part of it,
 * or void the whole thing.
 */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePageAccess("billing:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const [invoice, history] = await Promise.all([
    getInvoiceDetail(id),
    recordHistory("Invoice", id),
  ]);
  if (!invoice) notFound();

  const isCredit = invoice.documentType === "credit_note";
  const canWrite = can(me, "billing:write");
  const canCancel = can(me, "billing:delete");
  /*
    What this document still accepts. Payment and Credit are invoice-only;
    Cancel applies to a credit note too, because one raised in error has to be
    voidable and cancelling it releases its quantities back to the invoice.
    See lib/erp/one.ts, which enforces the same three rules on the URLs.
  */
  const open = invoice.status === "issued" && !invoice.isHistorical;
  const live = open && !isCredit;

  /* Displayed magnitude. The stored sign is what every sum relies on. */
  const money = (paise: number) => formatINR(isCredit ? Math.abs(paise) : paise);
  const count = (quantity: number) => (isCredit ? Math.abs(quantity) : quantity);

  const partyName = invoice.party.businessName || invoice.party.name;
  const tel = telHref(invoice.party.phone);
  const chat = whatsappHref(
    invoice.party.phone,
    paymentReminder({
      name: partyName,
      number: invoice.number,
      amount: formatRupees(invoice.owedPaise),
    }),
  );

  return (
    <div className="space-y-5">
      <RecordHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title={invoice.number || "(no number)"}
        pills={
          <>
            <StatusPill status={isCredit ? "credit note" : invoice.status} />
            {!isCredit && <StatusPill status={invoice.payment.status} />}
            {invoice.isHistorical && <StatusPill status="filed" />}
            {invoice.isSample && <StatusPill status="sample" />}
            {invoice.issuedAt && (
              <span className="text-ink-faint">
                {formatIstDateLong(new Date(invoice.issuedAt))}
              </span>
            )}
            {invoice.financialYear && (
              <span className="text-ink-faint">FY {invoice.financialYear}</span>
            )}
          </>
        }
        meta={
          isCredit && invoice.againstNumber ? (
            <>
              Reverses{" "}
              {invoice.againstInvoiceId ? (
                <Link
                  href={`/admin/invoices/${invoice.againstInvoiceId}`}
                  className="font-semibold text-ink hover:underline"
                >
                  {invoice.againstNumber}
                </Link>
              ) : (
                <span className="font-semibold text-ink">{invoice.againstNumber}</span>
              )}
            </>
          ) : undefined
        }
        actions={
          <>
            <Link
              href={`/admin/invoices/${invoice.id}/print`}
              className="admin-btn admin-btn-primary admin-tap"
            >
              Print
            </Link>
            {canWrite && live && (
              <Link
                href={`/admin/invoices/${invoice.id}/payment`}
                className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive"
              >
                Payment
              </Link>
            )}
            {/*
              Offered only while there is something left to credit. A fully
              credited invoice used to still show the button, and the form
              behind it opened with every line at zero.
            */}
            {canWrite && live && invoice.creditable && (
              <Link
                href={`/admin/invoices/${invoice.id}/credit-note`}
                className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive"
              >
                Credit note
              </Link>
            )}
            {canCancel && open && (
              <Link
                href={`/admin/invoices/${invoice.id}/cancel`}
                className="admin-btn admin-tap text-ink-soft hover:bg-danger/12 hover:text-danger"
              >
                Cancel
              </Link>
            )}
          </>
        }
      />

      {invoice.status === "cancelled" && (
        <p className="admin-card border-danger/40 px-4 py-3 text-sm font-semibold text-danger">
          Cancelled. It keeps its number and stays on the return as a cancelled
          document — a gap in a GST series is something the department asks
          about.
        </p>
      )}

      {isCredit && invoice.reason && (
        <p className="admin-card px-4 py-3 text-sm text-ink">
          <span className="font-semibold">Reason:</span> {invoice.reason}{" "}
          <span className="text-ink-faint">
            — printed on the note and filed with the return.
          </span>
        </p>
      )}

      {/* ---------- Money ---------- */}
      <section className="admin-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label={isCredit ? "Credited" : "Invoiced"} value={money(invoice.grandTotalPaise)} />
          {!isCredit && (
            <>
              <Stat label="Received" value={formatINR(invoice.payment.paidPaise)} />
              <Stat
                label="Credited back"
                value={formatINR(invoice.creditedPaise)}
                hint={
                  invoice.creditNotes.length > 0
                    ? `${invoice.creditNotes.length} note${invoice.creditNotes.length === 1 ? "" : "s"}`
                    : undefined
                }
              />
              <Stat
                label="Still owed"
                value={formatINR(invoice.owedPaise)}
                tone={invoice.owedPaise > 0 ? "danger" : undefined}
                hint={
                  invoice.owedPaise > 0
                    ? "invoiced − received − credited"
                    : "settled"
                }
              />
            </>
          )}
        </div>

        {invoice.payment.referenceNo && (
          <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
            Paid by{" "}
            <span className="font-semibold text-ink">{invoice.payment.referenceNo}</span>
            {invoice.payment.paidAt &&
              ` on ${formatIstDateLong(new Date(invoice.payment.paidAt))}`}
          </p>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-5">
          {/* ---------- Lines ---------- */}
          <section className="admin-card p-4">
            <h2 className="font-display text-base font-bold text-ink-strong">
              {isCredit ? "What was reversed" : "What was sold"}
            </h2>
            {/* Its own scroll box. Eight columns do not fit a phone, and the
                page must not scroll sideways to carry them. */}
            <div className="-mx-4 mt-3 overflow-x-auto px-4">
              <table className="w-full min-w-[36rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
                    <th className="py-2 pr-3 font-semibold">Description</th>
                    <th className="py-2 pr-3 font-semibold">HSN</th>
                    <th className="py-2 pr-3 text-right font-semibold">Qty</th>
                    <th className="py-2 pr-3 text-right font-semibold">Rate</th>
                    <th className="py-2 pr-3 text-right font-semibold">GST</th>
                    <th className="py-2 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line, i) => (
                    <tr key={i} className="border-b border-line-soft/60 align-top">
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-ink-strong">
                          {line.description}
                        </span>
                        {line.packLabel && (
                          <span className="text-ink-faint"> · {line.packLabel}</span>
                        )}
                        {/*
                          The credit position, per line. It was computed inside
                          issueCreditNote() and thrown away, so the only way to
                          see it was to open the credit form and read what the
                          quantities defaulted to.
                        */}
                        {!isCredit && line.creditedQuantity > 0 && (
                          <p className="text-xs font-semibold text-cta">
                            {line.creditedQuantity} credited
                            {line.creditableQuantity > 0
                              ? ` · ${line.creditableQuantity} left`
                              : " · nothing left to credit"}
                          </p>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-ink-muted">{line.hsn}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {count(line.quantity)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatINR(line.unitPricePaise)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-ink-muted">
                        {formatRate(line.gstRateBps)}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {money(line.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="mt-4 space-y-1 border-t border-line-soft pt-3 text-sm">
              <Row label="Taxable value" value={money(invoice.subtotalPaise)} />
              {invoice.supplyType === "intra" ? (
                <>
                  <Row label="CGST" value={money(invoice.cgstPaise)} />
                  <Row label="SGST" value={money(invoice.sgstPaise)} />
                </>
              ) : (
                <Row label="IGST" value={money(invoice.igstPaise)} />
              )}
              {invoice.roundOffPaise !== 0 && (
                <Row label="Round off" value={money(invoice.roundOffPaise)} />
              )}
              <Row label="Total" value={money(invoice.grandTotalPaise)} strong />
            </dl>
            {invoice.amountInWords && (
              <p className="mt-2 text-xs font-semibold text-ink-soft">
                {invoice.amountInWords}
              </p>
            )}
            {invoice.notes && (
              <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
                {invoice.notes}
              </p>
            )}
          </section>

          {/* ---------- Credit notes against it ---------- */}
          {!isCredit && invoice.creditNotes.length > 0 && (
            <section className="admin-card p-4">
              <h2 className="font-display text-base font-bold text-ink-strong">
                Credit notes against this invoice
              </h2>
              <p className="mt-0.5 text-xs text-ink-muted">
                The invoice stays as it was issued. Each of these is a separate
                filed document that reverses part of it.
              </p>
              <ul className="mt-3 divide-y divide-line-soft">
                {invoice.creditNotes.map((note) => (
                  <li key={note.id} className="flex flex-wrap items-baseline gap-3 py-2">
                    <Link
                      href={`/admin/invoices/${note.id}`}
                      className="text-sm font-semibold text-ink hover:underline"
                    >
                      {note.number}
                    </Link>
                    {note.status === "cancelled" && <StatusPill status="cancelled" />}
                    <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                      {note.reason}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-cta">
                      {formatINR(Math.abs(note.grandTotalPaise))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <RecordHistory
            entries={history}
            emptyMessage="Nothing has been recorded against this document since it was issued."
          />
        </div>

        {/* ---------- Party ---------- */}
        <div className="space-y-5">
          <section className="admin-card p-4">
            <h2 className="font-display text-base font-bold text-ink-strong">
              Billed to
            </h2>
            <p className="mt-0.5 text-xs text-ink-faint">
              As it read on the day. A customer moving village does not alter a
              document that has been filed.
            </p>

            <p className="mt-3 font-semibold text-ink-strong">
              {invoice.contactId ? (
                <Link
                  href={`/admin/contacts/${invoice.contactId}`}
                  className="hover:underline"
                >
                  {partyName}
                </Link>
              ) : (
                partyName
              )}
            </p>
            {invoice.party.businessName && invoice.party.name !== partyName && (
              <p className="text-sm text-ink-muted">{invoice.party.name}</p>
            )}

            <dl className="mt-3 space-y-2">
              <Field
                label="GSTIN"
                value={invoice.party.gstin}
                hint={
                  invoice.party.gstin
                    ? "A B2B sale, listed individually on GSTR-1."
                    : undefined
                }
              />
              {!invoice.party.gstin && (
                <p className="text-xs text-ink-faint">
                  No GSTIN — a B2C sale, summarised as B2CS on the return.
                </p>
              )}
              <Field
                label="Place of supply"
                value={`${invoice.placeOfSupplyStateCode} · ${
                  invoice.supplyType === "intra"
                    ? "intra-state, CGST + SGST"
                    : "inter-state, IGST"
                }`}
              />
              <Field
                label="Address"
                value={
                  [
                    invoice.party.address,
                    invoice.party.village,
                    invoice.party.district,
                    invoice.party.pin,
                    invoice.party.state,
                  ]
                    .filter(Boolean)
                    .join(", ") || ""
                }
              />
            </dl>

            {(tel || chat) && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                {tel && (
                  <a
                    href={tel}
                    className="admin-tap inline-flex items-center rounded-full border border-line px-4 text-xs font-semibold text-ink hover:border-olive"
                  >
                    Call {invoice.party.phone}
                  </a>
                )}
                {/* Only where money is actually outstanding — the message says
                    what is owed, and "you owe ₹0" is worse than no button. */}
                {chat && invoice.owedPaise > 0 && (
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
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger";
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p
        className={`mt-0.5 font-display text-lg font-bold tabular-nums ${
          tone === "danger" ? "text-danger" : "text-ink-strong"
        }`}
      >
        {value}
      </p>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        strong ? "border-t border-line-soft pt-2 text-base font-bold text-ink-strong" : ""
      }`}
    >
      <dt className={strong ? "" : "text-ink-muted"}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
