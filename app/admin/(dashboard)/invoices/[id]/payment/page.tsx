import { RecordPaymentForm } from "@/components/admin/InvoiceActionForms";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { issuedInvoiceOr404 } from "@/lib/erp/one";
import { formatIstDateLong } from "@/lib/time";

export const metadata = { title: "Record a payment" };
export const dynamic = "force-dynamic";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");
  const { id } = await params;
  const doc = await issuedInvoiceOr404(id);

  return (
    <>
      <FormPageHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title={<>Payment for {doc.number}</>}
        description={
          [
            doc.party?.businessName || doc.party?.name,
            doc.issuedAt
              ? `issued ${formatIstDateLong(new Date(doc.issuedAt))}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />
      <RecordPaymentForm
        invoiceId={id}
        number={doc.number ?? ""}
        grandTotalPaise={doc.grandTotalPaise ?? 0}
        paidPaise={doc.payment?.paidPaise ?? 0}
        status={doc.payment?.status ?? "unpaid"}
      />
    </>
  );
}
