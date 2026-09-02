import { Suspense } from "react";
import { InvoiceWorkspace } from "@/components/admin/InvoiceWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { betaNote, can } from "@/lib/auth/permissions";
import { invoiceListQuery, listInvoices } from "@/lib/erp/list";
import { listQueryKey } from "@/lib/crm/scopes";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePageAccess("billing:read");
  const beta = betaNote("billing");

  /*
    Just the list. The catalogue and the customer list moved to the form's
    own route, /admin/invoices/new, which is where they are needed.

    Built from the URL rather than fixed to page 1, so a shared or bookmarked
    link renders the rows it names instead of rendering the unfiltered list
    and letting the browser replace it a moment later — see useListState.
  */
  const url = await searchParams;
  const one = (key: string) => {
    const value = url[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  const query = invoiceListQuery({
    search: one("q"),
    filter: one("filter"),
    page: Number(one("page")) || 1,
  });
  const initialData = await listInvoices(query);

  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <InvoiceWorkspace
        beta={beta}
        initialData={initialData}
        initialQuery={listQueryKey(query)}
        canWrite={can(me, "billing:write")}
        canCancel={can(me, "billing:delete")}
      />
    </Suspense>
  );
}
