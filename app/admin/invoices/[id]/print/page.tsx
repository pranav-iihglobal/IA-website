import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { SITE } from "@/lib/content";
import { sellerFrom } from "@/lib/erp/seller";
import { formatINR } from "@/lib/money";
import { describeQuantity } from "@/lib/erp/quantity";
import { formatRate } from "@/lib/erp/tax";
import { formatIstDateLong } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";
import { PrintButton } from "@/components/admin/PrintButton";
import { whatsappHref } from "@/lib/crm/contact-links";

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
 *
 * A CREDIT NOTE prints from the same page. It is stored with negative amounts
 * — that is what makes every internal sum work without a special case — but a
 * printed credit note reads "₹1,050", not "−₹1,050". So the sign is dropped
 * HERE, at the point of display, and nowhere earlier.
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
  const isCredit = doc.documentType === "credit_note";
  // The invoice's own copy of who sold it — never the current setting.
  const seller = sellerFrom(doc.seller);
  const rateRows = summariseByRate(doc.lines ?? []);

  /* Displayed magnitude. The stored sign is what the sums rely on. */
  const money = (paise: number) => formatINR(isCredit ? Math.abs(paise ?? 0) : (paise ?? 0));

  return (
    /*
      p-4 on a phone, p-8 from sm. Two inches of white margin on a 358px
      screen left the document itself about 290px wide — on the one screen
      where this is actually pulled up, in front of a customer.
    */
    <div className="mx-auto w-full max-w-[820px] bg-white p-4 text-[13px] text-black sm:p-8 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          /* The scroll container is a screen affordance; on paper the table
             must lay out at its natural width, not inside a 640px box. */
          .lines-scroll { overflow: visible !important; }
          .lines-table { min-width: 0 !important; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between gap-4">
        <Link href="/admin/invoices" className="text-sm font-semibold underline">
          ← Back to invoices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            The funnel is WhatsApp, so getting the customer the NUMBER and the
            AMOUNT is one tap — no PDF library, no public link, no decision
            for anybody to take. The document itself still goes as a printed
            PDF; whether it should instead be a signed, expiring public link
            is a security question for the directors and is deliberately not
            answered here.
          */}
          <ShareOnWhatsApp
            phone={doc.party?.phone ?? ""}
            name={doc.party?.businessName || doc.party?.name || ""}
            number={doc.number ?? ""}
            amount={money(doc.grandTotalPaise ?? 0)}
            isCredit={isCredit}
          />
          <PrintButton />
        </div>
      </div>

      {!seller.gstin && (
        <p className="mb-4 border-2 border-red-600 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          This is NOT a valid tax invoice: IKSARVA&rsquo;s own GSTIN is missing.
          Set it on the Settings page before issuing this to a customer.
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
            GSTIN: {seller.gstin || "— not set —"}
            {seller.pan ? ` · PAN: ${seller.pan}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold uppercase tracking-wider">
            {isCredit ? "Credit Note" : "Tax Invoice"}
          </p>
          <p className="mt-2 text-base font-bold">{doc.number}</p>
          {/*
            The IST date. This page is a server component, so
            `toLocaleDateString` formatted in the server's UTC and printed the
            previous day on anything raised before 05:30 IST — on the document
            itself. See lib/time.ts.
          */}
          <p className="text-[12px]">
            {doc.issuedAt ? formatIstDateLong(new Date(doc.issuedAt)) : "—"}
          </p>
          {doc.financialYear && (
            <p className="text-[12px]">FY {doc.financialYear}</p>
          )}
          {isCredit && doc.againstNumber && (
            <p className="mt-1 text-[12px] font-semibold">
              Against invoice {doc.againstNumber}
            </p>
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

      {/*
        The one table in the admin that never got its own scroll container.
        Eight columns crushed into 358px, or the whole page scrolling
        sideways — on a document meant to be read aloud to somebody.
      */}
      <div className="lines-scroll -mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="lines-table w-full min-w-[640px] border-collapse text-[12px]">
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
              <td className="py-1.5 pr-2">
                {line.description}
                {line.discountPaise ? (
                  <span className="block text-[11px]">
                    less discount {money(Math.abs(line.discountPaise))}
                    {line.discountType === "percent" ? ` (${(line.discountValue ?? 0) / 100}%)` : ""}
                    {line.schemeName ? ` — ${line.schemeName}` : ""}
                  </span>
                ) : null}
              </td>
              <td className="py-1.5 pr-2">{line.hsn}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {describeQuantity(line as { quantity: number; uom?: string; boxes?: number })}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatINR(line.unitPricePaise)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {money(line.taxableValuePaise)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatRate(line.gstRateBps)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {money(line.lineTotalPaise)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

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
                  {money(r.taxableValuePaise)}
                </td>
                {intra ? (
                  <>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {money(r.cgstPaise)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {money(r.sgstPaise)}
                    </td>
                  </>
                ) : (
                  <td className="py-1 text-right tabular-nums">
                    {money(r.igstPaise)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <table className="ml-auto border-collapse text-[12px]">
          <tbody>
            <Total label="Taxable value" value={money(doc.subtotalPaise)} />
            {intra ? (
              <>
                <Total label="CGST" value={money(doc.cgstPaise)} />
                <Total label="SGST" value={money(doc.sgstPaise)} />
              </>
            ) : (
              <Total label="IGST" value={money(doc.igstPaise)} />
            )}
            {/* Shown explicitly. A difference that quietly disappears between
                the computed total and the printed one is how books stop tying. */}
            {doc.roundOffPaise !== 0 && (
              <Total label="Round off" value={money(doc.roundOffPaise)} />
            )}
            <tr className="border-t-2 border-black">
              <td className="py-1.5 pr-6 font-bold">
                {isCredit ? "Credit total" : "Total"}
              </td>
              <td className="py-1.5 text-right text-base font-bold tabular-nums">
                {money(doc.grandTotalPaise)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/*
        Derived from the same integer as the total, so they cannot disagree.
        Stored on a credit note as "Minus Rupees …" because the total is
        negative; the word is dropped for print alongside the sign, so the
        figure and the words still say the same thing. A display transform of
        the stored string, not a recalculation of it.
      */}
      <p className="mt-3 border-t border-black/30 pt-2 text-[12px]">
        <span className="font-semibold">Amount in words:</span>{" "}
        {isCredit
          ? String(doc.amountInWords ?? "").replace(/^Minus\s+/, "")
          : doc.amountInWords}
      </p>

      {isCredit && doc.reason && (
        <p className="mt-2 text-[12px]">
          <span className="font-semibold">Reason:</span> {doc.reason}
        </p>
      )}

      {doc.notes && <p className="mt-2 text-[12px]">{doc.notes}</p>}

      {/*
        Payment details, printed so a customer can pay from the page itself.
        The UPI id is not decoration: a farmer with a phone can settle a
        printed invoice without having to ring anyone for the account number.
      */}
      {/* Not printed on a credit note: the money moves the other way. */}
      {!isCredit && seller.bank.accountNo && (
        <div className="mt-3 border-t border-black/30 pt-2 text-[11px] leading-relaxed">
          <p className="font-semibold">Payment</p>
          <p>
            {seller.bank.accountName} · {seller.bank.name} · A/c{" "}
            {seller.bank.accountNo} · IFSC {seller.bank.ifsc}
          </p>
          {seller.bank.upi && <p>UPI: {seller.bank.upi}</p>}
        </div>
      )}

      {doc.status === "cancelled" && doc.cancelledReason && (
        <p className="mt-3 text-[11px] font-semibold">
          Cancelled: {doc.cancelledReason}
        </p>
      )}

      <footer className="mt-10 flex items-end justify-between text-[11px]">
        <p className="max-w-[46ch] leading-snug">
          {isCredit
            ? `This credit note reduces the amount due on ${doc.againstNumber || "the invoice above"}.`
            : "Goods once sold will not be taken back."}{" "}
          Subject to {SITE.address.district} jurisdiction.
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

function Total({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="py-1 pr-6">{label}</td>
      <td className="py-1 text-right tabular-nums">{value}</td>
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

/**
 * Send the customer the number and the amount, on the channel they use.
 *
 * Not the document — that still goes as a printed PDF. This is the message
 * that always precedes it, typed out by hand every time: "your bill
 * IA.09.26.014 comes to ₹4,250".
 *
 * Absent, rather than disabled, when the snapshot holds no usable number.
 * The party is a SNAPSHOT taken at issue, so an older invoice may carry a
 * number in a shape dialable() will not guess at, and a link that rings the
 * wrong person is worse than no link.
 */
function ShareOnWhatsApp({
  phone,
  name,
  number,
  amount,
  isCredit,
}: {
  phone: string;
  name: string;
  number: string;
  amount: string;
  isCredit: boolean;
}) {
  const href = whatsappHref(
    phone,
    isCredit
      ? `Namaste ${name}, this is IKSARVA Agritech. Credit note ${number} for ${amount} has been raised against your bill. The document follows.`
      : `Namaste ${name}, this is IKSARVA Agritech. Your invoice ${number} comes to ${amount}. The bill follows. Thank you.`,
  );
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center rounded-full border border-black px-4 text-sm font-semibold"
    >
      Send on WhatsApp
    </a>
  );
}
