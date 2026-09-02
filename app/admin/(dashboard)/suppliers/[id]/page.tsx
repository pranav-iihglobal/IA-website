import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { recordHistory } from "@/lib/admin/history";
import { getSupplierDetail } from "@/lib/erp/suppliers";
import { RecordHistory } from "@/components/admin/RecordHistory";
import { EmptyState, StatusPill } from "@/components/admin/ui";
import { PURCHASE_CATEGORIES } from "@/components/admin/PurchaseForm";
import { telHref } from "@/lib/crm/contact-links";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";

export const metadata = { title: "Supplier" };
export const dynamic = "force-dynamic";

/**
 * One supplier: what they have billed, this year and ever, and how much of
 * the GST on it is claimable. "How much did we buy from Shree Poly Pack this
 * year" — the question that could not be asked while a supplier was free
 * text retyped on every bill.
 */
export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePageAccess("billing:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const [supplier, history] = await Promise.all([
    getSupplierDetail(id),
    recordHistory("Supplier", id),
  ]);
  if (!supplier) notFound();

  const tel = telHref(supplier.phone);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/suppliers"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← Suppliers
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong">{supplier.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {supplier.isSample && <StatusPill status="sample" />}
            {supplier.gstin ? (
              <span className="text-ink-faint">GSTIN {supplier.gstin}</span>
            ) : (
              <span className="text-cta">no GSTIN — no input credit on their bills</span>
            )}
            {[supplier.city, supplier.state].filter(Boolean).length > 0 && (
              <span className="text-ink-faint">
                {[supplier.city, supplier.state].filter(Boolean).join(", ")}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={tel} className="admin-btn admin-tap border border-line bg-raised/70 text-ink hover:border-olive">
              Call {supplier.phone}
            </a>
          )}
          {can(me, "billing:write") && (
            <Link href={`/admin/suppliers/${id}/edit`} className="admin-btn admin-btn-primary admin-tap">
              Edit
            </Link>
          )}
        </div>
      </header>

      <section className="admin-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="This financial year" value={formatRupees(supplier.fyTotalPaise)} />
          <Stat
            label="Input credit this year"
            value={formatRupees(supplier.fyCreditPaise)}
            hint="GST on their eligible bills"
          />
          <Stat label="All time" value={formatRupees(supplier.allTimeTotalPaise)} />
          <Stat label="Bills on file" value={String(supplier.bills.length)} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 sm:grid-cols-4">
          <Field label="Email" value={supplier.email} />
          <Field label="Address" value={supplier.address} />
          <Field label="Supplies" value={supplier.stockItems.map((s) => s.name).join(", ")} />
        </dl>
        {supplier.notes && (
          <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
            {supplier.notes}
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-base font-bold text-ink-strong">Their bills</h2>
        {supplier.bills.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No bills yet"
              message="Purchases picked against this supplier will appear here."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line-soft rounded-2xl border border-line-soft/60 bg-surface">
            {supplier.bills.map((bill) => (
              <li key={bill.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/admin/purchases/${bill.id}`}
                    className="font-semibold text-ink-strong hover:text-cta hover:underline"
                  >
                    {bill.billNo || bill.description || "Bill"}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                    <StatusPill status={bill.paymentStatus} />
                    {bill.billDate && <span>{formatIstDateLong(new Date(bill.billDate))}</span>}
                    <span>
                      {PURCHASE_CATEGORIES.find((c) => c.value === bill.category)?.label ?? bill.category}
                    </span>
                    {bill.description && bill.billNo && <span>{bill.description}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-bold tabular-nums text-ink-strong">
                    {formatINR(bill.totalPaise)}
                  </p>
                  <p className="text-xs text-ink-faint">
                    GST {formatRupees(bill.gstPaise)}
                    {bill.inputCreditEligible ? ", claimable" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecordHistory entries={history} emptyMessage="No change has been recorded yet." />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink-strong">{value}</p>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
