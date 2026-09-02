import { Suspense } from "react";
import { StockWorkspace } from "@/components/admin/StockWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listStock } from "@/lib/erp/inventory-list";
import { stockListQuery } from "@/lib/erp/inventory-query";
import { listQueryKey } from "@/lib/crm/scopes";
import { one } from "@/lib/admin/search-params";

export const metadata = { title: "Stock" };
export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePageAccess("billing:read");

  /*
    One shared query, used here and by the API route the screen calls after
    a search — so the rows in the HTML and the rows fetched a moment later
    come from one definition rather than two that can disagree.

    Built from the URL, like the CRM lists: search, filter, sort and page are
    in the query string, so a shared link renders the rows it names.

    It also carries the company-wide figures. Those used to be recomputed in
    the browser from the capped list, which made them quietly LOW past 500
    items and quietly wrong during a search. See lib/erp/inventory-list.ts.
  */
  const url = await searchParams;
  const query = stockListQuery({
    search: one(url, "q"),
    filter: one(url, "filter"),
    sort: one(url, "sort"),
    page: Number(one(url, "page")) || 1,
  });
  const initial = await listStock(query);

  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <StockWorkspace
        initial={initial}
        initialQuery={listQueryKey(query)}
        canWrite={can(me, "billing:write")}
        canDelete={can(me, "billing:delete")}
      />
    </Suspense>
  );
}
