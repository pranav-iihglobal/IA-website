import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { DownloadLink } from "@/components/admin/ui";
import { GstRows } from "@/components/admin/GstRows";
import { invoicesForPeriod } from "@/lib/erp/reports";
import { buildGstReturn, buildHsnSummary } from "@/lib/erp/gst";
import { formatPeriod, parsePeriod, periodLabel } from "@/lib/erp/gst-period";

export const metadata = { title: "GST return — rows" };
export const dynamic = "force-dynamic";

/**
 * Every GSTR-1 row for one period, section by section.
 *
 * The summary at /admin/gst says how much and whether it is ready; this is
 * where a figure is checked against the portal, row by row. Cards on a
 * phone, tables from lg — see GstRows.
 */
export default async function GstRowsPage({
  params,
}: {
  params: Promise<{ period: string }>;
}) {
  await requirePageAccess("billing:read");

  const { period: raw } = await params;
  const period = parsePeriod(raw);
  if (!period) notFound();
  const key = formatPeriod(period);

  const invoices = await invoicesForPeriod(period.year, period.month);
  const built = buildGstReturn(invoices);
  const hsn = buildHsnSummary(invoices);

  const download = (section: string) => (
    <DownloadLink href={`/api/admin/gst?period=${key}&section=${section}`} label="Download CSV" />
  );

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/gst?period=${key}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink"
      >
        ← GST return
      </Link>
      <div>
        <h1 className="font-display text-2xl font-bold text-ink-strong">{periodLabel(period)}, row by row</h1>
        <p className="mt-0.5 text-sm text-ink-muted">
          The sections as they will be filed. Net figures are on the summary.
        </p>
      </div>

      <GstRows
        built={built}
        hsn={hsn}
        downloads={{
          b2b: download("b2b"),
          b2cs: download("b2cs"),
          cdnr: download("cdnr"),
          cdnur: download("cdnur"),
          hsn: download("hsn"),
        }}
      />
    </div>
  );
}
