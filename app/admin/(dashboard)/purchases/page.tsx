import { PurchaseWorkspace } from "@/components/admin/PurchaseWorkspace";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listPurchases } from "@/lib/erp/inventory-list";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const me = await requirePageAccess("billing:read");

  // One shared query, and figures that are not the sum of the capped rows —
  // see lib/erp/inventory-list.ts.
  const initial = await listPurchases();

  return (
    <PurchaseWorkspace
      initial={initial}
      canWrite={can(me, "billing:write")}
      canDelete={can(me, "billing:delete")}
    />
  );
}
