import { Suspense } from "react";
import { SupplierWorkspace } from "@/components/admin/SupplierWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listSuppliers } from "@/lib/erp/suppliers";
import { listQueryKey } from "@/lib/crm/scopes";
import { one } from "@/lib/admin/search-params";

export const metadata = { title: "Suppliers" };
export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requirePageAccess("billing:read");

  const url = await searchParams;
  const query = new URLSearchParams({ page: String(Number(one(url, "page")) || 1) });
  if (one(url, "q")) query.set("search", one(url, "q"));
  const initial = await listSuppliers(query);

  return (
    <Suspense fallback={<ListPageSkeleton rows={5} />}>
      <SupplierWorkspace
        initial={initial}
        initialQuery={listQueryKey(query)}
        canWrite={can(me, "billing:write")}
      />
    </Suspense>
  );
}
