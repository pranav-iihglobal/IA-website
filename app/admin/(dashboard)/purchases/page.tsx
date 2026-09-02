import { Suspense } from "react";
import { PurchaseWorkspace } from "@/components/admin/PurchaseWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listPurchases } from "@/lib/erp/inventory-list";
import { purchaseListQuery } from "@/lib/erp/inventory-query";
import { listQueryKey } from "@/lib/crm/scopes";
import { one } from "@/lib/admin/search-params";

export const metadata = { title: "Purchases" };
export const dynamic = "force-dynamic";

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePageAccess("billing:read");

  // One shared query built from the URL, and figures that are not the sum
  // of the rows — see lib/erp/inventory-list.ts.
  const url = await searchParams;
  const query = purchaseListQuery({
    search: one(url, "q"),
    filter: one(url, "filter"),
    sort: one(url, "sort"),
    page: Number(one(url, "page")) || 1,
  });
  const initial = await listPurchases(query);

  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <PurchaseWorkspace
        initial={initial}
        initialQuery={listQueryKey(query)}
        canWrite={can(me, "billing:write")}
        canDelete={can(me, "billing:delete")}
      />
    </Suspense>
  );
}
