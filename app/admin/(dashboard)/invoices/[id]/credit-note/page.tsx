import {
  CreditNoteForm,
  type CreditLineInput,
} from "@/components/admin/InvoiceActionForms";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { invoiceForActionOr404 } from "@/lib/erp/one";
import { formatINR } from "@/lib/money";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Raise a credit note" };
export const dynamic = "force-dynamic";

export default async function CreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");
  const { id } = await params;
  // issueCreditNote() refuses to credit a credit note, so the form should
  // never appear rather than be filled in and then rejected.
  const doc = await invoiceForActionOr404(id);

  /*
    The lines come with the page. The list row does not carry them, and a
    partial credit is meaningless without them — "credit 3 of the 10 sachets"
    needs to know there were ten. The dialog fetched them on open and showed
    "Reading the invoice…" while it did; a page has them in the HTML.
  */
  const lines: CreditLineInput[] = (doc.lines ?? []).map(
    (l: LeanDoc, index: number) => ({
      index,
      description: l.description ?? "",
      packLabel: l.packLabel ?? "",
      invoiced: l.quantity ?? 0,
    }),
  );

  return (
    <>
      <FormPageHeader
        backHref="/admin/invoices"
        backLabel="Invoices"
        title={<>Credit note against {doc.number}</>}
        description={`${doc.party?.businessName || doc.party?.name || ""} · ${formatINR(
          doc.grandTotalPaise ?? 0,
        )} invoiced`}
      />
      <CreditNoteForm invoiceId={id} number={doc.number ?? ""} lines={lines} />
    </>
  );
}
