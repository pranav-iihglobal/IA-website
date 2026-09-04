import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { recordHistory } from "@/lib/admin/history";
import { RecordHistory } from "@/components/admin/RecordHistory";
import { RecordHeader, StatusPill } from "@/components/admin/ui";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem, needsReorder } from "@/lib/db/models/StockItem";
import { formatINR, formatRupees } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Stock item" };
export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  finished: "Finished goods",
  packaging: "Packaging",
  raw: "Raw material",
};

/**
 * One stock item.
 *
 * Stock here is a COUNT, not a derived figure — it moves for reasons no
 * invoice records: a sample handed to a farmer, a bag split in transit, a
 * recount that found six more than the book said. Which makes "who counted
 * this, and what did they say it was before" the question about a stock
 * record, and it was unanswerable: every count has been written to the audit
 * log since the log was wired up, and the only screen that could read it
 * showed all changes to all records in one stream.
 *
 * So the history is the point of this page, and the figures above it are
 * there to be read rather than typed — the previous /admin/stock/<id> was the
 * edit form, which showed the same ten fields but as inputs, and could not
 * show the one thing that is not a field.
 */
export default async function StockDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePageAccess("billing:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, history] = await Promise.all([
    StockItem.findById(id).lean() as Promise<LeanDoc | null>,
    recordHistory("StockItem", id),
  ]);
  if (!doc) notFound();

  const onHand = doc.onHand ?? 0;
  const unitCostPaise = doc.unitCostPaise ?? 0;
  const low = needsReorder(doc);

  return (
    <div className="space-y-5">
      <RecordHeader
        backHref="/admin/stock"
        backLabel="Stock"
        title={doc.name}
        pills={
          <>
            {low && <StatusPill status="unpaid" />}
            {doc.isSample && <StatusPill status="demo" />}
            <span className="text-ink-faint">
              {KIND_LABELS[doc.kind ?? "finished"] ?? doc.kind}
            </span>
            {doc.sku && <span className="text-ink-faint">{doc.sku}</span>}
          </>
        }
        actions={
          can(me, "billing:write") ? (
            <Link
              href={`/admin/stock/${id}/edit`}
              className="admin-btn admin-btn-primary admin-tap"
            >
              Record a count
            </Link>
          ) : undefined
        }
      />

      {low && (
        <p className="admin-card px-4 py-3 text-sm font-semibold text-danger">
          At or below the reorder level of {doc.reorderLevel}. This alert is
          only as fresh as the last count — selling does not decrement stock in
          this system, by design.
        </p>
      )}

      <section className="admin-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="On hand"
            value={`${onHand} ${doc.unit ?? "unit"}${onHand === 1 ? "" : "s"}`}
            tone={low ? "danger" : undefined}
          />
          <Stat
            label="Reorder at"
            value={
              (doc.reorderLevel ?? 0) > 0 ? String(doc.reorderLevel) : "not tracked"
            }
            hint={(doc.reorderLevel ?? 0) > 0 ? undefined : "zero means no alert"}
          />
          <Stat
            label="Unit cost"
            value={unitCostPaise ? formatINR(unitCostPaise) : "—"}
          />
          <Stat
            label="Value at cost"
            value={formatRupees(unitCostPaise * onHand)}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line-soft pt-3 sm:grid-cols-4">
          <Field label="Supplier" value={doc.supplier} />
          <Field label="Location" value={doc.location} />
          <Field
            label="Last counted"
            value={
              doc.countedAt
                ? formatIstDateLong(new Date(doc.countedAt))
                : "never through this system"
            }
          />
        </dl>

        {doc.notes && (
          <p className="mt-3 border-t border-line-soft pt-3 text-sm text-ink-muted">
            {doc.notes}
          </p>
        )}
      </section>

      <RecordHistory
        entries={history}
        emptyMessage="No count has been recorded through this system yet."
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
