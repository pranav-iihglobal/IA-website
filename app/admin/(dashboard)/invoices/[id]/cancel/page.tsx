import { CancelInvoiceForm } from "@/components/admin/InvoiceActionForms";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { invoiceForActionOr404 } from "@/lib/erp/one";
import { formatINR } from "@/lib/money";

export const metadata = { title: "Cancel an invoice" };
export const dynamic = "force-dynamic";

export default async function CancelInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // billing:delete, not billing:write. Voiding a filed document is the one
  // invoice action that is not part of raising or settling one.
  await requirePageAccess("billing:delete");
  const { id } = await params;
  // A credit note raised in error has to be voidable too — the engine
  // supports it, and cancelling one releases its quantities back.
  const doc = await invoiceForActionOr404(id, { allowCreditNote: true, allowSampleNote: true });

  return (
    <>
      <FormPageHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title={<>Cancel {doc.number}</>}
        description={`${doc.party?.businessName || doc.party?.name || ""} · ${formatINR(
          doc.grandTotalPaise ?? 0,
        )}`}
      />
      <CancelInvoiceForm invoiceId={id} number={doc.number ?? ""} />
    </>
  );
}
