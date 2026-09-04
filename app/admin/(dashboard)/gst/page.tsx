import Link from "next/link";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { DownloadLink } from "@/components/admin/ui";
import { invoicesForPeriod, sampleInvoicesInPeriod } from "@/lib/erp/reports";
import {
  b2bCsv,
  b2csCsv,
  buildGstReturn,
  buildHsnSummary,
  cdnCsv,
  hsnCsv,
} from "@/lib/erp/gst";
import {
  csvSize,
  currentPeriod,
  formatPeriod,
  parsePeriod,
  periodLabel,
  sectionCounts,
  type Period,
} from "@/lib/erp/gst-period";
import { formatRupees } from "@/lib/money";
import { getSeller } from "@/lib/admin/settings";
import { MonthPicker } from "@/components/admin/MonthPicker";

export const metadata = { title: "GST filing" };
export const dynamic = "force-dynamic";

/**
 * What the CA files — the summary.
 *
 * Five figures, then the sections with their row counts (each a link into
 * the rows page), then the notes about what is and is not in them, then the
 * five downloads. The rows themselves moved to /admin/gst/[period]: five
 * seven-column tables on one page was the whole return on a phone screen,
 * and the question asked here month after month is "how much, and is it
 * ready" — not "show me every row".
 *
 * The headline figures are NET — supplies less credit notes — because that
 * is the month's liability. Everything on this page and the CSVs come from
 * the same buildGstReturn(), so what is checked is what is filed.
 */
export default async function GstPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; year?: string; month?: string }>;
}) {
  await requirePageAccess("billing:read");

  const sp = await searchParams;
  // ?period=2026-09 is the form the picker writes; year/month still accepted.
  const fromYearMonth = Number(sp.year) && Number(sp.month) ? { year: Number(sp.year), month: Number(sp.month) } : null;
  const period: Period =
    parsePeriod(sp.period) ??
    (fromYearMonth && fromYearMonth.month >= 1 && fromYearMonth.month <= 12 ? fromYearMonth : currentPeriod());
  const key = formatPeriod(period);

  const [invoices, sampleCount, seller] = await Promise.all([
    invoicesForPeriod(period.year, period.month),
    sampleInvoicesInPeriod(period.year, period.month),
    getSeller(),
  ]);
  const built = buildGstReturn(invoices);
  const hsn = buildHsnSummary(invoices);
  const sections = sectionCounts(built, hsn);
  const notes = built.cdnr.length + built.cdnur.length;
  const empty = sections.every((s) => s.rows === 0);

  /*
    The CSVs are built here too — the same functions the download route runs
    — so each link can say how many rows and how many kilobytes it is
    handing over. Five files, no zip: the portal wants them separate.
  */
  const csv: Record<string, string> = {
    b2b: b2bCsv(built.b2b),
    b2cs: b2csCsv(built.b2cs),
    cdnr: cdnCsv(built.cdnr, true),
    cdnur: cdnCsv(built.cdnur, false),
    hsn: hsnCsv(hsn),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-strong">GST return</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            GSTR-1 for {periodLabel(period)}. GSTIN {seller.gstin || "not set"}.
          </p>
        </div>
        <MonthPicker
          year={period.year}
          month={period.month}
          href={(y, m) => `/admin/gst?period=${formatPeriod({ year: y, month: m })}`}
        />
      </div>

      <section className="admin-card grid grid-cols-2 gap-4 p-4 sm:grid-cols-5">
        <Figure label="Taxable value" value={formatRupees(built.totals.taxableValuePaise)} />
        <Figure label="CGST" value={formatRupees(built.totals.cgstPaise)} />
        <Figure label="SGST" value={formatRupees(built.totals.sgstPaise)} />
        <Figure label="IGST" value={formatRupees(built.totals.igstPaise)} />
        <Figure label="Invoice value" value={formatRupees(built.totals.invoiceValuePaise)} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="admin-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-bold text-ink-strong">Sections</h2>
            {!empty && (
              <Link href={`/admin/gst/${key}`} className="text-xs font-semibold text-cta hover:underline">
                Every row →
              </Link>
            )}
          </div>
          {empty ? (
            <p className="mt-3 text-sm text-ink-muted">No invoices issued in {periodLabel(period)}.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line-soft">
              {sections.map((s) => (
                <li key={s.key}>
                  <Link
                    href={`/admin/gst/${key}#${s.key}`}
                    className="admin-tap -mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink-strong">{s.label}</span>
                      <span className="block text-xs text-ink-soft">{s.hint}</span>
                    </span>
                    <span
                      className={`shrink-0 font-display text-lg font-bold tabular-nums ${
                        s.rows === 0 ? "text-ink-faint" : "text-ink-strong"
                      }`}
                    >
                      {s.rows} <span className="text-xs font-semibold text-ink-soft">row{s.rows === 1 ? "" : "s"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card p-4">
          <h2 className="font-display text-base font-bold text-ink-strong">What these figures include</h2>
          {/*
            Said out loud, in one place. Each of these used to be its own
            banner when it applied; a return whose totals do not match the
            invoice list invites somebody to "fix" the wrong one.
          */}
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li>
              <strong className="font-semibold">
                {sampleCount} demo invoice{sampleCount === 1 ? "" : "s"} excluded.
              </strong>{" "}
              Seeded demo data never appears in a return
              {sampleCount > 0 ? ", which is why these totals are lower than the invoice list this month" : ""}.
            </li>
            <li>
              <strong className="font-semibold">
                {built.excludedCancelled} cancelled invoice{built.excludedCancelled === 1 ? "" : "s"} excluded.
              </strong>{" "}
              A cancellation is not a supply; reporting one would overstate the liability.
            </li>
            <li>
              <strong className="font-semibold">
                {notes} credit note{notes === 1 ? "" : "s"} netted.
              </strong>{" "}
              The supply stays in B2B or B2CS; the credit is reported in CDNR or CDNUR, and the
              figures above are net of it.
            </li>
            <li>
              <strong className="font-semibold">Sample notes are not here.</strong> Free samples are
              not a supply for consideration and never reach the return.
            </li>
            <li>
              Place of supply is a two-digit <strong>state code</strong> — 24 is Gujarat. Worth
              confirming with your CA that no earlier filing relied on a PIN code in this column.
            </li>
          </ul>
        </section>
      </div>

      <section className="admin-card p-4">
        <h2 className="font-display text-base font-bold text-ink-strong">Export</h2>
        <p className="mt-0.5 text-xs text-ink-soft">
          Five files, one per section, as the portal wants them. Each says what it holds before you download it.
        </p>
        {empty ? (
          <p className="mt-3 text-sm text-ink-muted">Nothing to export for {periodLabel(period)}.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {sections.map((s) => (
              <li key={s.key} className="rounded-xl border border-line-soft/60 p-3">
                <p className="text-sm font-semibold text-ink-strong">{s.label}</p>
                <p className="text-xs text-ink-soft">
                  {s.rows} row{s.rows === 1 ? "" : "s"} · {csvSize(csv[s.key])}
                </p>
                <div className="mt-2">
                  {s.rows > 0 ? (
                    <DownloadLink href={`/api/admin/gst?period=${key}&section=${s.key}`} label="Download CSV" />
                  ) : (
                    <span className="text-xs text-ink-faint">empty this month</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums text-ink-strong">{value}</p>
    </div>
  );
}
