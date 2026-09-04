import { RaiseInvoiceForm } from "@/components/admin/RaiseInvoiceForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { getBillableProducts, getSampleParties } from "@/lib/admin/invoice-options";

export const metadata = { title: "Give a sample" };
export const dynamic = "force-dynamic";

/**
 * The invoice form in its sample mode: who, what, how many — no prices, no
 * place of supply, no discount. Issues a Sample note (SMP.MM.YY.NNN), moves
 * stock, stamps the lead's sampling record. Not a tax invoice.
 */
export default async function GiveSamplePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("billing:write");

  const [products, parties, url] = await Promise.all([
    getBillableProducts(),
    getSampleParties(),
    searchParams,
  ]);
  const party = Array.isArray(url.party) ? url.party[0] : url.party;

  return (
    <>
      <FormPageHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title="Give a sample"
        description="No charge and no GST — a Sample note, not a tax invoice. Stock is reduced by what is handed over, and the person's sampling record is updated."
      />
      <div className="mt-8">
        <RaiseInvoiceForm
          mode="sample"
          products={products}
          parties={parties}
          initialPartyId={party ?? ""}
        />
      </div>
    </>
  );
}
