import { EMPTY_SUPPLIER, SupplierForm } from "@/components/admin/SupplierForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "New supplier" };
export const dynamic = "force-dynamic";

export default async function NewSupplierPage() {
  await requirePageAccess("billing:write");

  return (
    <>
      <FormPageHeader
        backHref="/admin/suppliers"
        backLabel="Suppliers"
        title="New supplier"
        description="Their GSTIN is entered once here, and every bill snapshots it."
      />
      <div className="mt-8">
        <SupplierForm initial={EMPTY_SUPPLIER} />
      </div>
    </>
  );
}
