import { SchemeForm } from "@/components/admin/SchemeForm";
import { EMPTY_SCHEME } from "@/lib/admin/form-defaults";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { getProductOptions } from "@/lib/admin/products-options";

export const metadata = { title: "New scheme" };
export const dynamic = "force-dynamic";

export default async function NewSchemePage() {
  await requirePageAccess("billing:write");
  const products = await getProductOptions();

  return (
    <>
      <FormPageHeader
        backHref="/admin/schemes"
        backLabel="Schemes"
        title="New scheme"
        description="A discount that applies itself between two moments. A typed discount on the invoice always wins."
      />
      <div className="mt-8">
        <SchemeForm
          initial={EMPTY_SCHEME}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
        />
      </div>
    </>
  );
}
