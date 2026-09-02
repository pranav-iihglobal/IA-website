import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { recordHistory } from "@/lib/admin/history";
import { RecordHistory } from "@/components/admin/RecordHistory";
import { PURCHASE_CATEGORIES } from "@/components/admin/PurchaseForm";
import { StatusPill } from "@/components/admin/ui";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Purchase" };
export const dynamic = "force-dynamic";

/**
 * One supplier bill.
 *
 * The figures are transcribed from their paper, never computed — if their
 * arithmetic disagrees with ours, theirs is the one that was filed. The form
 * says so while you type; this says so afterwards, which is when somebody is
 * actually reconciling against the bill in their hand.
 *
 * The two things the edit form could not show: whether the parts still tie to
 * the stated total, as a settled fact rather than a warning under a field;
 * and who has touched the record since. A transcribed figure that has been
 * quietly corrected twice is exactly the case the audit log exists for.
 */
export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePageAccess("billing:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, history] = await Promise.all([
    Purchase.findById(id).lean() as Promise<LeanDoc | null>,
    recordHistory("Purchase", id),
  ]);
  if (!doc) notFound();

  const taxable = doc.taxableValuePaise ?? 0;
  const cgst = doc.cgstPaise ?? 0;
  const sgst = doc.sgstPaise ?? 0;
  const igst = doc.igstPaise ?? 0;
  const total = doc.totalPaise ?? 0;
  const paid = doc.paidPaise ?? 0;

  const computed = taxable + cgst + sgst + igst;
  const mismatch = total > 0 && computed > 0 && total !== computed;
  const gstPaise = cgst + sgst + igst;
  const byDirector = doc.paidBy === "director";
  const category =
    PURCHASE_CATEGORIES.find((c) => c.value === doc.category)?.label ??
    doc.category ??
    "other";

  return (
    <div className="space-y-5">
      <Link
        href="/admin/purchases"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← Purchases
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            {/* The name as it was on the bill; the link is to the record. */}
            {doc.supplierId ? (
              <Link
                href={`/admin/suppliers/${String(doc.supplierId)}`}
                className="hover:text-cta hover:underline"
              >
                {doc.supplier}
              </Link>
            ) : (
              doc.supplier
            )}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <StatusPill status={doc.paymentStatus ?? "unpaid"} />
            {doc.isSample && <StatusPill status="sample" />}
            {doc.billNo && <span className="text-ink-faint">{doc.billNo}</span>}
            {doc.billDate && (
              <span className="text-ink-faint">
                {formatIstDateLong(new Date(doc.billDate))}
              </span>
            )}
            <span className="text-ink-faint">{category}</span>
          </p>
          {doc.description && (
            <p className="mt-1 text-sm text-ink-muted">{doc.description}</p>
          )}
        </div>
        {can(me, "billing:write") && (
          <Link
            href={`/admin/purchases/${id}/edit`}
            className="admin-btn admin-btn-primary admin-tap"
          >
            Edit
          </Link>
        )}
      </header>

      {mismatch && (
        <p className="admin-card px-4 py-3 text-sm font-semibold text-danger">
          The parts add up to {formatINR(computed)}, but the stated total is{" "}
          {formatINR(total)}. Kept as entered — their document is the one that
          was filed, and correcting it here would misrepresent it. Worth
          checking the paper.
        </p>
      )}

      <section className="admin-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Bill total" value={formatINR(total)} />
          <Stat label="Paid" value={formatINR(paid)} />
          <Stat
            label="Input credit"
            value={doc.inputCreditEligible ? formatINR(gstPaise) : "not claimable"}
            hint={
              doc.inputCreditEligible
                ? "your CA's to claim"
                : byDirector
                  ? "a director paid personally"
                  : "marked not eligible"
            }
          />
          <Stat
            label="Paid by"
            value={byDirector ? doc.paidByName || "a director" : "The company"}
            tone={byDirector ? "danger" : undefined}
            hint={byDirector ? "owed back" : undefined}
          />
        </div>

        <dl className="mt-4 space-y-1 border-t border-line-soft pt-3 text-sm">
          <Row label="Taxable value" value={formatINR(taxable)} />
          {igst > 0 ? (
            <Row label="IGST" value={formatINR(igst)} />
          ) : (
            <>
              <Row label="CGST" value={formatINR(cgst)} />
              <Row label="SGST" value={formatINR(sgst)} />
            </>
          )}
          <Row label="Total, as stated on their bill" value={formatINR(total)} strong />
        </dl>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 sm:grid-cols-3">
          <Field label="Supplier GSTIN" value={doc.supplierGstin} />
          {!doc.supplierGstin && (
            <div className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Supplier GSTIN
              </dt>
              <dd className="mt-0.5 text-sm text-ink-faint">
                none — nothing to claim
              </dd>
            </div>
          )}
          <Field label="Their bill number" value={doc.billNo} />
          <Field
            label="Bill date"
            value={doc.billDate ? formatIstDateLong(new Date(doc.billDate)) : ""}
          />
        </dl>

        {byDirector && (
          <p className="mt-3 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm text-ink-muted">
            {formatRupees(total)} of company cost paid personally. This app does
            not keep a ledger — the figure is here so your CA does not have to
            reconstruct it.
          </p>
        )}

        {doc.notes && (
          <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
            {doc.notes}
          </p>
        )}
      </section>

      <RecordHistory
        entries={history}
        emptyMessage="Nothing has been changed since this bill was entered."
      />
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

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
