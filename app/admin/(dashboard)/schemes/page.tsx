import { SchemeWorkspace } from "@/components/admin/SchemeWorkspace";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { listSchemes } from "@/lib/erp/scheme-store";

export const metadata = { title: "Schemes" };
export const dynamic = "force-dynamic";

export default async function SchemesPage() {
  const me = await requirePageAccess("billing:read");
  const list = await listSchemes();

  return (
    <SchemeWorkspace
      initial={list}
      canWrite={can(me, "billing:write")}
      canDelete={can(me, "billing:delete")}
    />
  );
}
