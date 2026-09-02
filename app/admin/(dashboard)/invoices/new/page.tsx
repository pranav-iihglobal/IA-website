import { RaiseInvoiceForm } from "@/components/admin/RaiseInvoiceForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import {
  getBillableParties,
  getBillableProducts,
} from "@/lib/admin/invoice-options";

export const metadata = { title: "Raise an invoice" };
export const dynamic = "force-dynamic";

export default async function RaiseInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("billing:write");

  const [products, parties, url] = await Promise.all([
    getBillableProducts(),
    getBillableParties(),
    searchParams,
  ]);

  // Arriving from a customer's profile: ?party=<id>.
  const party = Array.isArray(url.party) ? url.party[0] : url.party;
  const unpriced = products.filter((p) => p.blockedReason);

  return (
    <>
      <FormPageHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title="Raise an invoice"
        description="Issued once. The number is allocated at the end and cannot be changed afterwards — a correction is a credit note."
      />

      {/*
        Said here rather than discovered halfway through. A product with no
        rate or HSN is refused by the server, and finding that out after
        typing six lines is a poor way to learn it.
      */}
      {unpriced.length > 0 && (
        <p className="admin-card mt-6 px-4 py-2.5 text-sm text-ink">
          <strong className="font-semibold">
            {unpriced.length} product{unpriced.length === 1 ? "" : "s"} cannot be
            invoiced yet:
          </strong>{" "}
          {unpriced.map((p) => `${p.name} (${p.blockedReason?.toLowerCase()})`).join(" ")}{" "}
          Set them under Products.
        </p>
      )}

      <div className="mt-8">
        <RaiseInvoiceForm
          products={products}
          parties={parties}
          initialPartyId={party ?? ""}
        />
      </div>
    </>
  );
}
