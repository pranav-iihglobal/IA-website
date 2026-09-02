import { Suspense } from "react";
import { ContactWorkspace } from "@/components/admin/ContactWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { listContacts } from "@/lib/crm/list";
import { getProductOptions } from "@/lib/admin/products-options";
import { contactListQuery, listQueryKey } from "@/lib/crm/scopes";
import { betaNote } from "@/lib/auth/permissions";

export const metadata = { title: "Dealers" };
export const dynamic = "force-dynamic";

export default async function AdminDealersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAccess("crm:read");
  const beta = betaNote("crm");

  /*
    The first page, rendered here rather than fetched by the browser after
    hydration. That was a second request to the server and a second lookup of
    who you are, for rows this render could already have. The identity check
    above is deduped by React.cache(), so this costs one query and nothing else.
  */
  /*
    Built from the URL, not fixed to page 1. Search, filter and page are in
    the query string now (see useListState), so a shared link — or the
    dashboard's "Follow-ups due" tile — must render the rows it names rather
    than rendering the unfiltered list and letting the browser replace it a
    moment later.
  */
  const url = await searchParams;
  const one = (key: string) => {
    const value = url[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  const query = contactListQuery("dealers", {
    search: one("q"),
    filter: one("filter"),
    page: Number(one("page")) || 1,
  });
  const [initialData, products] = await Promise.all([
    listContacts(query),
    // The catalogue, for the sampled-products picker on the lead form.
    getProductOptions(),
  ]);

  return (
    <>
      {/* Suspense because the workspace reads the ?edit / ?new search params,
          which opts the subtree into client-side rendering. */}
      <Suspense fallback={<ListPageSkeleton rows={5} />}>
        <ContactWorkspace
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
          beta={beta}
          scope="dealers"
          initialData={initialData}
          initialQuery={listQueryKey(query)}
        />
      </Suspense>
    </>
  );
}
