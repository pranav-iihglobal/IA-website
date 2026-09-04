import { ListCard } from "./ui";
import type { B2BRow, B2CSRow, CdnRow, GstReturn, HsnRow } from "@/lib/erp/gst";
import { ASSUMED_UQC } from "@/lib/erp/gst";
import { formatRate } from "@/lib/erp/tax";
import { formatINR } from "@/lib/money";
import type { ReactNode } from "react";

/**
 * The GSTR-1 rows for one period, section by section.
 *
 * Cards below `lg`, tables from `lg`. The tables are what the CA checks
 * against the portal on a monitor; on a phone a seven-column table scrolled
 * sideways inside a card, and nothing about a row could be read without
 * dragging. Each section is anchored (`#b2b`) so the summary page can point
 * straight at it. Server-safe: no state, no hooks.
 */

const th = "py-2 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-faint";
const td = "py-2 pr-3 text-sm text-ink";
const num = `${td} text-right tabular-nums`;

function tax(r: { cgstPaise: number; sgstPaise: number; igstPaise: number }): number {
  return r.cgstPaise + r.sgstPaise + r.igstPaise;
}

function Section({
  id,
  title,
  rows,
  subtitle,
  download,
  cards,
  table,
}: {
  id: string;
  title: string;
  rows: number;
  subtitle: string;
  download?: ReactNode;
  cards: ReactNode;
  table: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-bold text-ink-strong">
            {title} — {rows} row{rows === 1 ? "" : "s"}
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">{subtitle}</p>
        </div>
        {download}
      </div>
      {rows === 0 ? (
        <p className="admin-card px-4 py-4 text-sm text-ink-muted">Nothing in this section.</p>
      ) : (
        <>
          <ul className="admin-rows grid gap-3 lg:hidden">{cards}</ul>
          <div className="admin-card hidden overflow-x-auto p-4 lg:block">{table}</div>
        </>
      )}
    </section>
  );
}

export function GstRows({
  built,
  hsn,
  downloads,
}: {
  built: GstReturn;
  hsn: HsnRow[];
  /** A CSV link per section, rendered by the page so it owns the URLs. */
  downloads: Record<"b2b" | "b2cs" | "cdnr" | "cdnur" | "hsn", ReactNode>;
}) {
  return (
    <div className="space-y-8">
      <Section
        id="b2b"
        title="B2B"
        rows={built.b2b.length}
        subtitle="Sales to a party with a GSTIN, listed individually so they can claim the input credit. One row per rate."
        download={built.b2b.length > 0 ? downloads.b2b : undefined}
        cards={built.b2b.map((r, i) => (
          <ListCard
            key={`${r.invoiceNo}-${r.gstRateBps}-${i}`}
            title={r.party}
            subtitle={`${r.invoiceNo} · ${r.invoiceDate}`}
            figure={formatINR(r.taxableValuePaise)}
            figureNote={`+ ${formatINR(tax(r))} tax at ${formatRate(r.gstRateBps)}`}
            pills={<span className="font-mono text-ink-faint">{r.gstin}</span>}
          />
        ))}
        table={<B2BTable rows={built.b2b} />}
      />

      <Section
        id="b2cs"
        title="B2CS"
        rows={built.b2cs.length}
        subtitle="Sales to unregistered buyers. Summarised per place of supply and rate — nobody is claiming credit, so the department wants totals, not names."
        download={built.b2cs.length > 0 ? downloads.b2cs : undefined}
        cards={built.b2cs.map((r) => (
          <ListCard
            key={`${r.placeOfSupply}-${r.gstRateBps}`}
            title={`State ${r.placeOfSupply}`}
            subtitle={`${r.invoices} invoice${r.invoices === 1 ? "" : "s"} at ${formatRate(r.gstRateBps)}`}
            figure={formatINR(r.taxableValuePaise)}
            figureNote={`+ ${formatINR(tax(r))} tax`}
          />
        ))}
        table={<B2CSTable rows={built.b2cs} />}
      />

      <Section
        id="cdnr"
        title="CDNR"
        rows={built.cdnr.length}
        subtitle="Credit notes to buyers with a GSTIN, listed individually — they reverse the input credit claimed against the original invoice."
        download={built.cdnr.length > 0 ? downloads.cdnr : undefined}
        cards={built.cdnr.map((r, i) => (
          <CdnCard key={`${r.noteNo}-${r.gstRateBps}-${i}`} row={r} registered />
        ))}
        table={<CdnTable rows={built.cdnr} registered />}
      />

      <Section
        id="cdnur"
        title="CDNUR"
        rows={built.cdnur.length}
        subtitle="Credit notes to unregistered buyers."
        download={built.cdnur.length > 0 ? downloads.cdnur : undefined}
        cards={built.cdnur.map((r, i) => (
          <CdnCard key={`${r.noteNo}-${r.gstRateBps}-${i}`} row={r} registered={false} />
        ))}
        table={<CdnTable rows={built.cdnur} registered={false} />}
      />

      <Section
        id="hsn"
        title="HSN summary"
        rows={hsn.length}
        subtitle="Table 12. Covers all supplies together, registered and unregistered — not the two sales sections added up."
        download={hsn.length > 0 ? downloads.hsn : undefined}
        cards={hsn.map((r) => (
          <ListCard
            key={`${r.hsn}-${r.gstRateBps}`}
            title={r.description}
            subtitle={`${r.quantity} ${r.uqc} at ${formatRate(r.gstRateBps)}`}
            figure={formatINR(r.taxableValuePaise)}
            figureNote={`${formatINR(r.totalValuePaise)} with tax`}
            pills={
              r.hsn ? (
                <span className="font-mono text-ink-faint">HSN {r.hsn}</span>
              ) : (
                <span className="text-cta">HSN not set</span>
              )
            }
          />
        ))}
        table={<HsnTable rows={hsn} />}
      />

      {hsn.length > 0 && (
        /*
          Said, not hidden. Assuming quietly on a filing is how a wrong
          return gets signed.
        */
        <p className="text-xs text-ink-soft">
          UQC is shown as <strong>{ASSUMED_UQC}</strong> for every line. Invoice
          lines do not record a unit code, and nothing here is sold by weight —
          sachets and canisters are counted. Confirm with your CA; if they want
          something else it becomes a field on the product.
        </p>
      )}
    </div>
  );
}

function B2BTable({ rows }: { rows: B2BRow[] }) {
  return (
    <table className="w-full min-w-[720px] border-collapse">
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
        {rows.map((r, i) => (
          <tr key={`${r.invoiceNo}-${r.gstRateBps}-${i}`} className="border-b border-line-soft">
            <td className={`${td} font-mono text-xs`}>{r.gstin}</td>
            <td className={td}>{r.party}</td>
            <td className={td}>{r.invoiceNo}</td>
            <td className={td}>{r.invoiceDate}</td>
            <td className={num}>{formatRate(r.gstRateBps)}</td>
            <td className={num}>{formatINR(r.taxableValuePaise)}</td>
            <td className={num}>{formatINR(tax(r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function B2CSTable({ rows }: { rows: B2CSRow[] }) {
  return (
    <table className="w-full min-w-[520px] border-collapse">
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
        {rows.map((r) => (
          <tr key={`${r.placeOfSupply}-${r.gstRateBps}`} className="border-b border-line-soft">
            <td className={td}>{r.placeOfSupply}</td>
            <td className={num}>{formatRate(r.gstRateBps)}</td>
            <td className={num}>{r.invoices}</td>
            <td className={num}>{formatINR(r.taxableValuePaise)}</td>
            <td className={num}>{formatINR(tax(r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Values are POSITIVE here. They are stored negative so every internal sum
 * works without a special case; buildGstReturn flips them, because the
 * portal wants a magnitude beside a note type.
 */
function CdnCard({ row: r, registered }: { row: CdnRow; registered: boolean }) {
  return (
    <ListCard
      title={r.party}
      subtitle={`${r.noteNo} · ${r.noteDate} · against ${r.againstNumber || "—"}`}
      figure={formatINR(r.taxableValuePaise)}
      figureNote={`+ ${formatINR(tax(r))} tax at ${formatRate(r.gstRateBps)}`}
      pills={registered ? <span className="font-mono text-ink-faint">{r.gstin}</span> : undefined}
      meta={r.reason}
    />
  );
}

function CdnTable({ rows, registered }: { rows: CdnRow[]; registered: boolean }) {
  return (
    <table className="w-full min-w-[720px] border-collapse">
      <thead>
        <tr className="border-b border-line">
          {registered && <th className={th}>GSTIN</th>}
          <th className={th}>Party</th>
          <th className={th}>Note</th>
          <th className={th}>Date</th>
          <th className={th}>Against</th>
          <th className={th}>Reason</th>
          <th className={`${th} text-right`}>Rate</th>
          <th className={`${th} text-right`}>Taxable</th>
          <th className={`${th} text-right`}>Tax</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.noteNo}-${r.gstRateBps}-${i}`} className="border-b border-line-soft">
            {registered && <td className={`${td} font-mono text-xs`}>{r.gstin}</td>}
            <td className={td}>{r.party}</td>
            <td className={td}>{r.noteNo}</td>
            <td className={td}>{r.noteDate}</td>
            <td className={td}>{r.againstNumber}</td>
            <td className={td}>{r.reason}</td>
            <td className={num}>{formatRate(r.gstRateBps)}</td>
            <td className={num}>{formatINR(r.taxableValuePaise)}</td>
            <td className={num}>{formatINR(tax(r))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HsnTable({ rows }: { rows: HsnRow[] }) {
  return (
    <table className="w-full min-w-[640px] border-collapse">
      <thead>
        <tr className="border-b border-line">
          <th className={th}>HSN</th>
          <th className={th}>Description</th>
          <th className={th}>UQC</th>
          <th className={`${th} text-right`}>Qty</th>
          <th className={`${th} text-right`}>Rate</th>
          <th className={`${th} text-right`}>Taxable</th>
          <th className={`${th} text-right`}>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.hsn}-${r.gstRateBps}`} className="border-b border-line-soft">
            <td className={`${td} font-mono text-xs`}>{r.hsn || <span className="text-cta">not set</span>}</td>
            <td className={td}>{r.description}</td>
            <td className={td}>{r.uqc}</td>
            <td className={num}>{r.quantity}</td>
            <td className={num}>{formatRate(r.gstRateBps)}</td>
            <td className={num}>{formatINR(r.taxableValuePaise)}</td>
            <td className={num}>{formatINR(r.totalValuePaise)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
