import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { invoicesForPeriod, sampleInvoicesInPeriod } from "@/lib/erp/reports";
import { buildGstReturn } from "@/lib/erp/gst";
import { formatRate } from "@/lib/erp/tax";
import { formatINR, formatRupees } from "@/lib/money";
import { SELLER } from "@/lib/content";
import { MonthPicker } from "@/components/admin/MonthPicker";

export const dynamic = "force-dynamic";

/**
 * What the CA files.
 *
 * B2B listed per invoice per rate, B2CS summarised per place of supply and
 * rate — the two sections GSTR-1 asks for. A GSTIN decides which section a
 * sale lands in; see lib/erp/gst.ts.
 *
 * The tables and the CSV download come from the same buildGstReturn(), so
 * what is checked on screen is what is filed.
 */
export default async function GstPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requirePageAccess("billing:read");

  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;

  const [built, sampleCount] = await Promise.all([
    invoicesForPeriod(year, month).then(buildGstReturn),
    sampleInvoicesInPeriod(year, month),
  ]);
  const stamp = `year=${year}&month=${month}`;
  const empty = built.b2b.length === 0 && built.b2cs.length === 0;

  const th = "py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint";
  const td = "py-2 pr-3 text-sm text-ink";
  const num = `${td} text-right tabular-nums`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-strong">GST return</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            GSTR-1 sections for your CA. GSTIN {SELLER.gstin}.
          </p>
        </div>
        <MonthPicker year={year} month={month} />
      </div>

      <section className="admin-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        <Figure label="Taxable value" value={formatRupees(built.totals.taxableValuePaise)} />
        <Figure label="CGST" value={formatRupees(built.totals.cgstPaise)} />
        <Figure label="SGST" value={formatRupees(built.totals.sgstPaise)} />
        <Figure label="IGST" value={formatRupees(built.totals.igstPaise)} />
        <Figure label="Invoice value" value={formatRupees(built.totals.invoiceValuePaise)} />
      </section>

      {/*
        Said out loud. The return excludes seeded invoices, so its totals will
        not match the invoice list while sample data is present — and an
        unexplained difference on a filing document invites someone to "fix"
        the wrong one.
      */}
      {sampleCount > 0 && (
        <p className="admin-card px-4 py-2.5 text-sm text-ink">
          <strong className="font-semibold">
            {sampleCount} sample invoice{sampleCount === 1 ? "" : "s"} excluded.
          </strong>{" "}
          Seeded data never appears in a GST return. That is why the totals here
          are lower than the invoice list for this month.
        </p>
      )}

      {built.excludedCancelled > 0 && (
        <p className="admin-card px-4 py-2.5 text-sm text-ink">
          {built.excludedCancelled} cancelled invoice
          {built.excludedCancelled === 1 ? " is" : "s are"} excluded — a cancellation
          is not a supply and reporting it would overstate the liability.
        </p>
      )}

      {empty ? (
        <p className="admin-card px-4 py-6 text-center text-sm text-ink-muted">
          No invoices issued in this month.
        </p>
      ) : (
        <>
          <section className="admin-card overflow-x-auto p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-ink-strong">
                B2B — {built.b2b.length} row{built.b2b.length === 1 ? "" : "s"}
              </h2>
              {built.b2b.length > 0 && (
                <Download href={`/api/admin/gst?${stamp}&section=b2b`} />
              )}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Sales to a party with a GSTIN, listed individually so they can claim
              the input credit. One row per rate.
            </p>
            <table className="mt-3 w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>GSTIN</th>
                  <th className={th}>Party</th>
                  <th className={th}>Invoice</th>
                  <th className={th}>Date</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>Tax</th>
                </tr>
              </thead>
              <tbody>
                {built.b2b.map((r, i) => (
                  <tr key={`${r.invoiceNo}-${r.gstRateBps}-${i}`} className="border-b border-line-soft">
                    <td className={`${td} font-mono text-xs`}>{r.gstin}</td>
                    <td className={td}>{r.party}</td>
                    <td className={td}>{r.invoiceNo}</td>
                    <td className={td}>{r.invoiceDate}</td>
                    <td className={num}>{formatRate(r.gstRateBps)}</td>
                    <td className={num}>{formatINR(r.taxableValuePaise)}</td>
                    <td className={num}>
                      {formatINR(r.cgstPaise + r.sgstPaise + r.igstPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="admin-card overflow-x-auto p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-base font-bold text-ink-strong">
                B2CS — {built.b2cs.length} row{built.b2cs.length === 1 ? "" : "s"}
              </h2>
              {built.b2cs.length > 0 && (
                <Download href={`/api/admin/gst?${stamp}&section=b2cs`} />
              )}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Sales to unregistered buyers. Summarised per place of supply and rate —
              nobody is claiming credit, so the department wants totals, not names.
            </p>
            <table className="mt-3 w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-b border-line">
                  <th className={th}>Place of supply</th>
                  <th className={`${th} text-right`}>Rate</th>
                  <th className={`${th} text-right`}>Invoices</th>
                  <th className={`${th} text-right`}>Taxable</th>
                  <th className={`${th} text-right`}>Tax</th>
                </tr>
              </thead>
              <tbody>
                {built.b2cs.map((r) => (
                  <tr key={`${r.placeOfSupply}-${r.gstRateBps}`} className="border-b border-line-soft">
                    <td className={td}>{r.placeOfSupply}</td>
                    <td className={num}>{formatRate(r.gstRateBps)}</td>
                    <td className={num}>{r.invoices}</td>
                    <td className={num}>{formatINR(r.taxableValuePaise)}</td>
                    <td className={num}>
                      {formatINR(r.cgstPaise + r.sgstPaise + r.igstPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/*
        Raised where it can be acted on. Their existing export carried a PIN
        in the place-of-supply column where GSTR-1 wants a state code.
      */}
      <p className="text-xs text-ink-soft">
        Place of supply is a two-digit <strong>state code</strong> — 24 is Gujarat.
        Worth confirming with your CA that no earlier filing relied on a PIN code
        in this column.
      </p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-strong">
        {value}
      </p>
    </div>
  );
}

function Download({ href }: { href: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="admin-tap inline-flex items-center rounded-full border border-line px-3.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-olive"
    >
      Download CSV
    </Link>
  );
}
