import { Suspense } from "react";
import { InvoiceWorkspace } from "@/components/admin/InvoiceWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { betaNote, can } from "@/lib/auth/permissions";
import { listInvoices } from "@/lib/erp/list";
import { listQueryKey } from "@/lib/crm/scopes";
import {
  getBillableParties,
  getBillableProducts,
} from "@/lib/admin/invoice-options";

export const dynamic = "force-dynamic";

export default async function AdminInvoicesPage() {
  const me = await requirePageAccess("billing:read");
  const beta = betaNote("billing");

  /*
    The first page, plus the two option lists the form needs, in one render.
    Three round trips to Mumbai in parallel rather than a page that paints and
    then goes back for everything — see lib/crm/list.ts for why.
  */
  const query = new URLSearchParams({ page: "1" });
  const [initialData, products, parties] = await Promise.all([
    listInvoices(query),
    getBillableProducts(),
    getBillableParties(),
  ]);

  const unpriced = products.filter((p) => p.blockedReason);

  return (
    <>
      {beta && (
        <p className="admin-card mb-4 flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-ink">
          <span className="rounded-full bg-accent-mid/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cornsilk-light">
            Beta
          </span>
          {beta}
        </p>
      )}

      {/*
        Said here rather than discovered halfway through raising an invoice.
        A product with no rate or HSN is refused by the server, and finding
        that out after typing six lines is a poor way to learn it.
      */}
      {unpriced.length > 0 && (
        <p className="admin-card mb-4 px-4 py-2.5 text-sm text-ink">
          <strong className="font-semibold">
            {unpriced.length} product{unpriced.length === 1 ? "" : "s"} cannot be
            invoiced yet:
          </strong>{" "}
          {unpriced.map((p) => `${p.name} (${p.blockedReason?.toLowerCase()})`).join(" ")}{" "}
          Set them under Products.
        </p>
      )}

      <Suspense fallback={<ListPageSkeleton rows={5} />}>
        <InvoiceWorkspace
          initialData={initialData}
          initialQuery={listQueryKey(query)}
          products={products}
          parties={parties}
          canWrite={can(me, "billing:write")}
          canCancel={can(me, "billing:delete")}
        />
      </Suspense>
    </>
  );
}
