"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "./ui";
import type { SampledProduct } from "@/lib/crm/profile";
import { ContactNotes, type ContactNote } from "./ContactNotes";
import { RecordHistory } from "./RecordHistory";
import type { HistoryEntry } from "@/lib/admin/history";
import { telHref, whatsappHref } from "@/lib/crm/contact-links";
import { FOLLOW_UP_LABELS, STATUS_LABELS } from "@/lib/crm/shape";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import type { ProfileInvoice, Trading } from "@/lib/crm/profile";

/**
 * One contact, read rather than edited.
 *
 * The CRM could change a record but never show one — the list opened straight
 * into a form. This is the read view: who they are and what they have bought,
 * with editing one click away, on the same kind of page every other module
 * uses.
 *
 * No charts. Three SKUs and a handful of orders per customer means a chart
 * here would be two points and a lot of white space, taking the room the
 * numbers need. The visual work is hierarchy: the figures that prompt an
 * action are large, and the one that means "ring them" is coloured.
 */

export interface ProfileContact {
  id: string;
  /** Mongoose __v — sent back on save, so a stale write is refused. */
  version: number;
  contactId: string;
  kind: string;
  channel: string;
  name: string;
  nameGu: string;
  businessName: string;
  phone: string;
  altPhone: string;
  email: string;
  place: string;
  district: string;
  region: string;
  crop: string;
  acres: number | null;
  source: string;
  owner: string;
  remarks: string;
  followUpAt: string | null;
  lastContactAt: string | null;
  nextAction: string;
  followUpStatus: string;
  /** Carried over from the spreadsheets — see the note in the trading block. */
  storedOrders: number;
  storedRevenuePaise: number;
  discountTier: string;
  subtype: string;
  dealer: {
    gstin: string;
    proprietor: string;
    tier: string;
    territory: string;
    creditLimitPaise: number;
    creditDays: number;
    paymentTerms: string;
    nextVisitAt: string | null;
  };
  isSample: boolean;
}

/**
 * A phone number you can act on: call it, or open WhatsApp.
 *
 * WhatsApp is not decoration here — it is how this business talks to farmers,
 * and it is a plain wa.me link, so no API, no cost and no verification.
 */
function ReachField({
  label,
  phone,
  name,
}: {
  label: string;
  phone: string;
  name: string;
}) {
  const tel = telHref(phone);
  const chat = whatsappHref(
    phone,
    `Namaste ${name}, this is IKSARVA Agritech.`,
  );
  if (!phone) return <Field label={label} value="" />;

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <div className="mt-0.5 flex flex-wrap items-center gap-2">
        {tel ? (
          <a href={tel} className="admin-tap font-semibold text-ink hover:underline">
            {phone}
          </a>
        ) : (
          <span className="text-ink">{phone}</span>
        )}
        {chat && (
          <a
            href={chat}
            target="_blank"
            rel="noreferrer"
            className="admin-tap inline-flex items-center rounded-full border border-line px-3 text-xs font-semibold text-ink-muted hover:border-olive"
          >
            WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm text-ink">{value}</dd>
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
        className={`mt-1 font-display text-2xl font-bold tabular-nums ${
          tone === "danger" ? "text-danger" : "text-ink-strong"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}

function date(value: string | null): string | null {
  return value ? formatIstDateLong(new Date(value)) : null;
}

export function ContactProfile({
  contact,
  invoices,
  trading,
  notes: initialNotes,
  history,
  canEdit,
  canSeeMoney,
  canBill = false,
  sampling,
  backHref,
  backLabel,
}: {
  contact: ProfileContact;
  invoices: ProfileInvoice[];
  trading: Trading;
  notes: ContactNote[];
  /** Every change to this record, from the audit log. */
  history: HistoryEntry[];
  canEdit: boolean;
  /** billing:read. Someone doing follow-up calls does not see the money. */
  canSeeMoney: boolean;
  /** billing:write, and this is a real customer — see the page for why. */
  canBill?: boolean;
  /** What was sampled, and whether it converted. Absent for a record with none. */
  sampling?: Sampling;
  backHref: string;
  backLabel: string;
}) {

  const [notes, setNotes] = useState(initialNotes);

  const isDealer = contact.channel === "b2b";
  /*
    A LEAD IS NOT A CUSTOMER, and this page used to show one as if it were.

    It is one route for all three kinds on purpose — they are one collection
    filtered three ways — but "one route" was being read as "one layout", and
    the layout was the customer's: four money figures, an Orders list, and a
    status pill derived from a last-order date a lead does not have, which
    renders as "Prospect". Opening a lead landed you on what read as a
    customer page with everything at zero.

    A lead cannot even be invoiced — getBillableParties() excludes them — so
    those figures are not merely empty, they are guaranteed empty. What a lead
    has instead is a sampling pipeline and a follow-up, and that is what the
    top of the page shows now.
  */
  const isLead = contact.kind === "lead";
  const title = contact.businessName || contact.name;

  return (
    <div className="space-y-5">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← {backLabel}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong">{title}</h1>
          {contact.businessName && contact.name !== contact.businessName && (
            <p className="text-sm text-ink-muted">{contact.name}</p>
          )}
          {contact.nameGu && <p className="text-sm text-ink-muted">{contact.nameGu}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {isLead ? (
              <StatusPill status="lead" />
            ) : (
              <StatusPill status={STATUS_LABELS[trading.status]} />
            )}
            {contact.contactId && (
              <span className="text-ink-faint">{contact.contactId}</span>
            )}
            {isDealer && <StatusPill status="dealer" />}
            {contact.isSample && <StatusPill status="sample" />}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/*
            Raising an invoice for the person on screen used to mean reading
            their name, going to Invoices and searching for them again. The
            party arrives prefilled — see InvoiceWorkspace.
          */}
          {canBill && (
            <Link
              href={`/admin/invoices/new?party=${contact.id}`}
              className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive hover:bg-surface-muted"
            >
              Raise an invoice
            </Link>
          )}
          {canEdit && (
            <Link
              href={`/admin/contacts/${contact.id}/edit`}
              className="admin-btn admin-btn-primary admin-tap"
            >
              Edit
            </Link>
          )}
        </div>
      </header>

      {/*
        Gated on billing:read, not crm:read. Someone chasing follow-ups has no
        business seeing what a customer spends, and this is the first screen
        where the two modules meet.
      */}
      {/* Where the lead has got to — the equivalent row, in the same place. */}
      {isLead && (
        <section className="admin-card p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Stage"
              value={FOLLOW_UP_LABELS[contact.followUpStatus] ?? "Not contacted"}
            />
            <Stat
              label="Sampled"
              value={
                sampling && sampling.products.length > 0
                  ? `${sampling.products.length} product${sampling.products.length === 1 ? "" : "s"}`
                  : sampling?.note
                    ? "recorded as text"
                    : "nothing yet"
              }
              hint={
                sampling?.sampleDate
                  ? date(sampling.sampleDate) ?? undefined
                  : undefined
              }
            />
            <Stat
              label="Follow up"
              value={date(contact.followUpAt) ?? "not set"}
              tone={
                contact.followUpAt && new Date(contact.followUpAt) <= new Date()
                  ? "danger"
                  : undefined
              }
              hint={
                contact.followUpAt && new Date(contact.followUpAt) <= new Date()
                  ? "due now"
                  : undefined
              }
            />
            <Stat
              label="Last contacted"
              value={date(contact.lastContactAt) ?? "never"}
            />
          </div>
          {contact.nextAction && (
            <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink">
              <span className="font-semibold">Next:</span> {contact.nextAction}
            </p>
          )}
        </section>
      )}

      {canSeeMoney && !isLead && (
        <section className="admin-card space-y-4 p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Bought"
              value={formatRupees(trading.invoicedPaise)}
              hint={`${trading.orders} order${trading.orders === 1 ? "" : "s"}`}
            />
            <Stat
              label="Outstanding"
              value={formatRupees(trading.outstandingPaise)}
              tone={trading.outstandingPaise > 0 ? "danger" : undefined}
              hint={trading.outstandingPaise > 0 ? "Owed now" : "Nothing due"}
            />
            <Stat
              label="Last order"
              value={date(trading.lastOrderAt) ?? "—"}
              hint={
                trading.daysSinceLastOrder === null
                  ? "Never ordered"
                  : `${trading.daysSinceLastOrder} days ago`
              }
            />
            <Stat
              label="First order"
              value={date(trading.firstOrderAt) ?? "—"}
            />
          </div>

          {/*
            The stored figures came from the spreadsheets and are the ONLY
            record of anything bought before this app existed. Shown separately
            and labelled rather than merged, because one number that is quietly
            incomplete is worse than two that each say what they are.
          */}
          {(contact.storedOrders > 0 || contact.storedRevenuePaise > 0) && (
            <p className="rounded-xl bg-surface-muted/50 px-3 py-2 text-xs text-ink-muted">
              <span className="font-semibold text-ink">
                Carried over from the sheets:
              </span>{" "}
              {contact.storedOrders} order
              {contact.storedOrders === 1 ? "" : "s"},{" "}
              {formatRupees(contact.storedRevenuePaise)}. The figures above count
              only invoices raised in this system — the two merge once the
              historical invoices are imported.
            </p>
          )}

          {trading.products.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                What they buy
              </p>
              <ul className="mt-1.5 space-y-1">
                {trading.products.map((p) => (
                  <li
                    key={p.description}
                    className="flex items-baseline justify-between gap-4 text-sm"
                  >
                    <span className="min-w-0 truncate text-ink">
                      {p.description}
                      <span className="text-ink-faint"> × {p.quantity}</span>
                    </span>
                    <span className="tabular-nums text-ink-muted">
                      {formatRupees(p.valuePaise)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="admin-card p-4">
          <h2 className="font-display text-base font-bold text-ink-strong">Details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {/*
              Tappable. There was not one tel: link in the whole admin — a CRM
              of 5,118 numbers, used on a phone in a field, where you could not
              ring anybody from it.
            */}
            <ReachField label="Phone" phone={contact.phone} name={contact.name} />
            <ReachField label="Alt phone" phone={contact.altPhone} name={contact.name} />
            <Field label="Email" value={contact.email} />
            <Field label="Place" value={contact.place} />
            <Field label="District" value={contact.district} />
            <Field label="Region" value={contact.region} />
            <Field label="Crop" value={contact.crop} />
            <Field label="Acres" value={contact.acres ? String(contact.acres) : null} />
            <Field label="Source" value={contact.source} />
            <Field label="Owner" value={contact.owner} />
            <Field label="Discount tier" value={contact.discountTier} />
            <Field label="Subtype" value={contact.subtype} />
            <Field label="Next action" value={contact.nextAction} />
            <Field label="Follow up" value={date(contact.followUpAt)} />
            <Field label="Last contacted" value={date(contact.lastContactAt)} />
          </dl>
          {contact.remarks && (
            <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
              {contact.remarks}
            </p>
          )}

          {isDealer && (
            <>
              <h3 className="mt-5 border-t border-line-soft pt-4 font-display text-sm font-bold text-ink-strong">
                Dealer terms
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-3">
                <Field label="GSTIN" value={contact.dealer.gstin} />
                <Field label="Proprietor" value={contact.dealer.proprietor} />
                <Field label="Tier" value={contact.dealer.tier} />
                <Field label="Territory" value={contact.dealer.territory} />
                {canSeeMoney && (
                  <Field
                    label="Credit limit"
                    value={
                      contact.dealer.creditLimitPaise
                        ? formatRupees(contact.dealer.creditLimitPaise)
                        : null
                    }
                  />
                )}
                <Field
                  label="Credit days"
                  value={contact.dealer.creditDays ? String(contact.dealer.creditDays) : null}
                />
                <Field label="Payment terms" value={contact.dealer.paymentTerms} />
                <Field label="Next visit" value={date(contact.dealer.nextVisitAt)} />
              </dl>
            </>
          )}

          <SamplingSection sampling={sampling} canSeeMoney={canSeeMoney} />
        </section>

        <div className="space-y-5">
          {canSeeMoney && !isLead && (
            <section className="admin-card p-4">
              <h2 className="font-display text-base font-bold text-ink-strong">
                Orders
              </h2>
              {invoices.length === 0 ? (
                <p className="mt-2 text-sm text-ink-muted">
                  No invoices in this system yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line-soft">
                  {invoices.map((inv) => (
                    <li key={inv.id} className="flex items-baseline gap-3 py-2">
                      <Link
                        /* The record, not the printable document. What is
                           still owed on an order is a question about its
                           history, and the paperwork cannot answer it. */
                        href={`/admin/invoices/${inv.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:underline"
                      >
                        {inv.number || "(no number)"}
                        {inv.documentType === "credit_note" && inv.againstNumber && (
                          <span className="ml-1 font-normal text-xs text-ink-faint">
                            credits {inv.againstNumber}
                          </span>
                        )}
                      </Link>
                      <span className="shrink-0 text-xs text-ink-faint">
                        {date(inv.issuedAt) ?? "—"}
                      </span>
                      {/*
                        Shown NEGATIVE here, unlike on the printed note. This is
                        the internal ledger view: the minus is what makes the
                        rows add up to the total above them.
                      */}
                      <span
                        className={`shrink-0 text-sm tabular-nums ${
                          inv.status === "cancelled"
                            ? "text-ink-faint line-through"
                            : "text-ink-strong"
                        }`}
                      >
                        {formatINR(inv.grandTotalPaise)}
                      </span>
                      <StatusPill
                        status={
                          inv.status === "cancelled"
                            ? "cancelled"
                            : inv.documentType === "credit_note"
                              ? "credit note"
                              : inv.paymentStatus
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              {trading.creditNoteCount > 0 && (
                <p className="mt-2 text-xs text-ink-faint">
                  {trading.creditNoteCount} credit note
                  {trading.creditNoteCount === 1 ? " is" : "s are"} netted off the
                  totals above, and not counted as orders.
                </p>
              )}
              {trading.cancelledCount > 0 && (
                <p className="mt-2 text-xs text-ink-faint">
                  {trading.cancelledCount} cancelled invoice
                  {trading.cancelledCount === 1 ? " is" : "s are"} shown but not
                  counted in the totals above.
                </p>
              )}
            </section>
          )}

          <section className="admin-card p-4">
            <h2 className="font-display text-base font-bold text-ink-strong">
              Calls and visits
            </h2>
            <div className="mt-3">
              <ContactNotes
                contactId={contact.id}
                notes={notes}
                onAdded={setNotes}
              />
            </div>
          </section>

          {/*
            The call log says what was DISCUSSED. This says what was CHANGED —
            who moved the follow-up date, who corrected the phone number. Both
            are appended and neither can be edited; they answer different
            questions and the profile had only the first.
          */}
          <RecordHistory
            entries={history}
            emptyMessage="Nothing has been changed since this record was created."
          />
        </div>
      </div>

    </div>
  );
}

export interface Sampling {
  products: SampledProduct[];
  /** The original free text, where the migration could not place it. */
  note: string;
  sampleDate: string | null;
  quantity: string;
  feedbackCollected: boolean;
  feedbackNotes: string;
}

/**
 * What was sampled, and whether it converted.
 *
 * The whole point of running a sampling programme, and until the products
 * became references it could not be shown at all: "FloraMax" and "Flora Max"
 * were two different things, so nothing could be matched against what was
 * later bought.
 *
 * It stays on the profile after a lead becomes a customer, deliberately —
 * conversion is exactly when the answer becomes interesting, and hiding it
 * then would throw the answer away at the moment it arrives.
 */
function SamplingSection({
  sampling,
  canSeeMoney,
}: {
  sampling?: Sampling;
  canSeeMoney: boolean;
}) {
  if (!sampling) return null;
  const { products, note, sampleDate, quantity, feedbackNotes } = sampling;
  const hasAnything =
    products.length > 0 || note || sampleDate || quantity || feedbackNotes;
  if (!hasAnything) return null;

  return (
    <>
      <h3 className="mt-5 border-t border-line-soft pt-4 font-display text-sm font-bold text-ink-strong">
        Sampling
      </h3>

      {products.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {products.map((p) => (
            <li key={p.productId} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-semibold text-ink">{p.name}</span>
              {p.bought ? (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-ink">
                  Bought {p.quantity}
                  {canSeeMoney ? ` · ${formatRupees(p.valuePaise)}` : ""}
                </span>
              ) : (
                <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                  Not bought yet
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/*
        Shown alongside, never instead. This is what somebody actually wrote
        down; where the migration could not match it to the catalogue it is
        the only record of what was given, and dropping it would lose that.
      */}
      {note && (
        <p className="mt-2 text-sm text-ink-muted">
          Recorded as: <span className="text-ink">{note}</span>
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Sampled on" value={date(sampleDate)} />
        <Field label="Quantity" value={quantity} />
      </dl>
      {feedbackNotes && (
        <p className="mt-2 text-sm text-ink-muted">{feedbackNotes}</p>
      )}
    </>
  );
}
