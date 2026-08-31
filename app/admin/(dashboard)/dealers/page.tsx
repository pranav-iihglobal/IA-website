import { Suspense } from "react";
import { ContactWorkspace } from "@/components/admin/ContactWorkspace";
import { ListPageSkeleton } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { betaNote } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AdminDealersPage() {
  await requirePageAccess("crm:read");
  const beta = betaNote("crm");

  return (
    <>
      {beta && (
        <p className="admin-card mb-4 flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm text-russet-dark/80">
          <span className="rounded-full bg-laurel-dark/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cornsilk-light">
            Beta
          </span>
          {beta}
        </p>
      )}
      {/* Suspense because the workspace reads the ?edit / ?new search params,
          which opts the subtree into client-side rendering. */}
      <Suspense fallback={<ListPageSkeleton rows={5} />}>
        <ContactWorkspace scope="dealers" />
      </Suspense>
    </>
  );
}
