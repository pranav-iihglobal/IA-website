import { Suspense } from "react";
import { ContactWorkspace } from "@/components/admin/ContactWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { listContacts } from "@/lib/crm/list";
import { SCOPE_QUERY, listQueryKey } from "@/lib/crm/scopes";
import { betaNote } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requirePageAccess("crm:read");
  const beta = betaNote("crm");

  /*
    The first page, rendered here rather than fetched by the browser after
    hydration. That was a second request to the server and a second lookup of
    who you are, for rows this render could already have. The identity check
    above is deduped by React.cache(), so this costs one query and nothing else.
  */
  const query = new URLSearchParams({ ...SCOPE_QUERY.customers, page: "1" });
  const initialData = await listContacts(query);

  return (
    <>
      {/* Suspense because the workspace reads the ?edit / ?new search params,
          which opts the subtree into client-side rendering. */}
      <Suspense fallback={<ListPageSkeleton rows={5} />}>
        <ContactWorkspace
          beta={beta}
          scope="customers"
          initialData={initialData}
          initialQuery={listQueryKey(query)}
        />
      </Suspense>
    </>
  );
}
