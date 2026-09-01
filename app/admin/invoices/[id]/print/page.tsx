import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { SELLER, SITE } from "@/lib/content";
import { formatINR } from "@/lib/money";
import { formatRate } from "@/lib/erp/tax";
import type { LeanDoc } from "@/lib/db/lean";
import { PrintButton } from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

/**
 * The tax invoice, as it is printed.
 *
 * Outside the (dashboard) route group on purpose, so it renders without the
 * sidebar — the same reason /admin/login sits outside it.
 *
 * NO PDF LIBRARY. The browser's "Save as PDF" produces the file, these get
 * printed on paper anyway, and adding a PDF renderer to make a document the
 * browser can already make would be a dependency bought with nothing.
 *
 * Everything here is READ from the stored invoice. Nothing is recomputed: the
 * totals were worked out once at issue and written down, and a rounding fix
 * shipped next year must not change what a document already filed says.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = (await Invoice.findById(id).lean()) as LeanDoc | null;
  if (!doc) notFound();

  const intra = doc.supplyType === "intra";
  const rateRows = summariseByRate(doc.lines ?? []);

  return (
    <div className="mx-auto w-full max-w-[820px] bg-white p-8 text-[13px] text-black print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <a href="/admin/invoices" className="text-sm font-semibold underline">
          ← Back to invoices
        </a>
        <PrintButton />
      </div>

      {!SELLER.gstin && (
        <p className="mb-4 border-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          This is NOT a valid tax invoice: IKSARVA&rsquo;s own GSTIN is missing.
          Set <code>SELLER.gstin</code> in lib/content.ts before issuing this to
          a customer.
        </p>
      )}

      {doc.status === "cancelled" && (
        <p className="mb-4 border-2 border-black px-4 py-2 text-center text-lg font-bold uppercase tracking-widest">
          Cancelled
        </p>
      )}

      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <h1 className="text-xl font-bold">{SITE.name}</h1>
          <p className="mt-1 max-w-[46ch] text-[12px] leading-snug">
            {SITE.address.street}, {SITE.address.city}, {SITE.address.district},{" "}
            {SITE.address.state} {SITE.address.postalCode}
          </p>
          <p className="mt-1 text-[12px]">
            {SITE.phoneDisplay} · {SITE.email}
          </p>
          <p className="mt-1 text-[12px] font-semibold">
            GSTIN: {SELLER.gstin || "— not set —"}
            {SELLER.pan ? ` · PAN: ${SELLER.pan}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-wider">Tax Invoice</p>
          <p className="mt-2 text-base font-bold">{doc.number}</p>
          <p className="text-[12px]">
            {doc.issuedAt
              ? new Date(doc.issuedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : "—"}
          </p>
          {doc.financialYear && (
            <p className="text-[12px]">FY {doc.financialYear}</p>
          )}
          {doc.isHistorical && (
            <p className="mt-1 text-[11px] font-semibold uppercase">Imported record</p>
          )}
        </div>
      </header>

      <section className="grid gap-6 border-b border-black py-4 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider">Bill to</p>
          <p className="mt-1 font-semibold">
            {doc.party?.businessName || doc.party?.name}
          </p>
          {doc.party?.businessName && doc.party?.name && (
            <p className="text-[12px]">{doc.party.name}</p>
          )}
          <p className="text-[12px] leading-snug">
            {[doc.party?.address, doc.party?.district, doc.party?.pin]
              .filter(Boolean)
              .join(", ")}
          </p>
          {doc.party?.phone && <p className="text-[12px]">{doc.party.phone}</p>}
          <p className="mt-1 text-[12px] font-semibold">
            GSTIN: {doc.party?.gstin || "Unregistered"}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider">
            Place of supply
          </p>
          {/* A state code, not a PIN. It is what decides the tax below. */}
          <p className="mt-1 font-semibold">
            {doc.placeOfSupplyStateCode} — {doc.party?.state || "Gujarat"}
          </p>
          <p className="mt-1 text-[12px]">
            {intra ? "Intra-state — CGST + SGST" : "Inter-state — IGST"}
          </p>
        </div>
      </section>

      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2">#</th>
            <th className="py-2 pr-2">Description</th>
            <th className="py-2 pr-2">HSN</th>
            <th className="py-2 pr-2 text-right">Qty</th>
            <th className="py-2 pr-2 text-right">Rate</th>
            <th className="py-2 pr-2 text-right">Taxable</th>
            <th className="py-2 pr-2 text-right">GST</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(doc.lines ?? []).map((line: LeanDoc, i: number) => (
            <tr key={i} className="border-b border-black/25 align-top">
              <td className="py-1.5 pr-2">{i + 1}</td>
              <td className="py-1.5 pr-2">{line.description}</td>
              <td className="py-1.5 pr-2">{line.hsn}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{line.quantity}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatINR(line.unitPricePaise)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatINR(line.taxableValuePaise)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatRate(line.gstRateBps)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatINR(line.lineTotalPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap justify-between gap-6">
        {/* The rate-wise summary a tax invoice carries, and GSTR-1 wants. */}
        <table className="border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1 pr-3">Rate</th>
              <th className="py-1 pr-3 text-right">Taxable</th>
              {intra ? (
                <>
                  <th className="py-1 pr-3 text-right">CGST</th>
                  <th className="py-1 text-right">SGST</th>
                </>
              ) : (
                <th className="py-1 text-right">IGST</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rateRows.map((r) => (
              <tr key={r.gstRateBps} className="border-b border-black/20">
                <td className="py-1 pr-3">{formatRate(r.gstRateBps)}</td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {formatINR(r.taxableValuePaise)}
                </td>
                {intra ? (
                  <>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {formatINR(r.cgstPaise)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatINR(r.sgstPaise)}
                    </td>
                  </>
                ) : (
                  <td className="py-1 text-right tabular-nums">
                    {formatINR(r.igstPaise)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <table className="ml-auto border-collapse text-[12px]">
          <tbody>
            <Total label="Taxable value" paise={doc.subtotalPaise} />
            {intra ? (
              <>
                <Total label="CGST" paise={doc.cgstPaise} />
                <Total label="SGST" paise={doc.sgstPaise} />
              </>
            ) : (
              <Total label="IGST" paise={doc.igstPaise} />
            )}
            {/* Shown explicitly. A difference that quietly disappears between
                the computed total and the printed one is how books stop tying. */}
            {doc.roundOffPaise !== 0 && (
              <Total label="Round off" paise={doc.roundOffPaise} />
            )}
            <tr className="border-t-2 border-black">
              <td className="py-1.5 pr-6 font-bold">Total</td>
              <td className="py-1.5 text-right text-base font-bold tabular-nums">
                {formatINR(doc.grandTotalPaise)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Derived from the same integer as the total, so they cannot disagree. */}
      <p className="mt-3 border-t border-black/30 pt-2 text-[12px]">
        <span className="font-semibold">Amount in words:</span> {doc.amountInWords}
      </p>

      {/*
        Transport is NOT in the totals above, and must not appear as though it
        were: computeInvoice() does not add it, so a row inside that stack
        would show a Total that is not the sum of the rows above it. Whether
        freight should be a taxable line on a composite supply is a question
        for the CA, not something to guess at on a filed document.
      */}
      {Boolean(doc.transportCharged) && doc.transportPaise > 0 && (
        <p className="mt-2 text-[12px]">
          <span className="font-semibold">Transport:</span>{" "}
          {formatINR(doc.transportPaise)} — recorded separately, not included in
          the total above.
        </p>
      )}

      {doc.notes && <p className="mt-2 text-[12px]">{doc.notes}</p>}

      {SELLER.bank.accountNo && (
        <p className="mt-3 text-[11px]">
          Bank: {SELLER.bank.name} · A/c {SELLER.bank.accountNo} · IFSC{" "}
          {SELLER.bank.ifsc}
        </p>
      )}

      {doc.status === "cancelled" && doc.cancelledReason && (
        <p className="mt-3 text-[11px] font-semibold">
          Cancelled: {doc.cancelledReason}
        </p>
      )}

      <footer className="mt-10 flex items-end justify-between text-[11px]">
        <p className="max-w-[46ch] leading-snug">
          Goods once sold will not be taken back. Subject to{" "}
          {SITE.address.district} jurisdiction.
        </p>
        <p className="text-right">
          For {SITE.name}
          <br />
          <span className="mt-8 inline-block">Authorised signatory</span>
        </p>
      </footer>
    </div>
  );
}

function Total({ label, paise }: { label: string; paise: number }) {
  return (
    <tr>
      <td className="py-1 pr-6">{label}</td>
      <td className="py-1 text-right tabular-nums">{formatINR(paise)}</td>
    </tr>
  );
}

/**
 * The rate-wise table, rebuilt from the STORED lines.
 *
 * Not recomputed from the products — summing what was written down is a
 * different act from working it out again, and only the first is safe on a
 * document already filed.
 */
function summariseByRate(lines: LeanDoc[]) {
  const rows = new Map<
    number,
    { gstRateBps: number; taxableValuePaise: number; cgstPaise: number; sgstPaise: number; igstPaise: number }
  >();
  for (const line of lines) {
    const key = line.gstRateBps ?? 0;
    const row = rows.get(key) ?? {
      gstRateBps: key,
      taxableValuePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    };
    row.taxableValuePaise += line.taxableValuePaise ?? 0;
    row.cgstPaise += line.cgstPaise ?? 0;
    row.sgstPaise += line.sgstPaise ?? 0;
    row.igstPaise += line.igstPaise ?? 0;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.gstRateBps - b.gstRateBps);
}
