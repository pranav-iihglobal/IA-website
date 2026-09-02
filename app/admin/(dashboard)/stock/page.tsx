import { StockWorkspace } from "@/components/admin/StockWorkspace";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listStock } from "@/lib/erp/inventory-list";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const me = await requirePageAccess("billing:read");

  /*
    One shared query, used here and by the API route the screen calls after
    a search — so the rows in the HTML and the rows fetched a moment later
    come from one definition rather than two that can disagree.

    It also carries the company-wide figures. Those used to be recomputed in
    the browser from the capped list, which made them quietly LOW past 500
    items and quietly wrong during a search. See lib/erp/inventory-list.ts.
  */
  const initial = await listStock();

  return (
    <StockWorkspace
      initial={initial}
      canWrite={can(me, "billing:write")}
      canDelete={can(me, "billing:delete")}
    />
  );
}
