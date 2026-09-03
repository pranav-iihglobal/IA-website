import { StockForm } from "@/components/admin/StockForm";
import { EMPTY_STOCK } from "@/lib/admin/form-defaults";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { getSupplierOptions } from "@/lib/admin/supplier-options";

export const metadata = { title: "New stock item" };
export const dynamic = "force-dynamic";

export default async function NewStockItemPage() {
  await requirePageAccess("billing:write");
  const suppliers = await getSupplierOptions();

  return (
    <>
      <FormPageHeader
        backHref="/admin/stock"
        backLabel="Stock"
        title="New stock item"
        description="Saving records a count — the date stamps itself."
      />
      <div className="mt-8">
        <StockForm initial={EMPTY_STOCK} suppliers={suppliers} />
      </div>
    </>
  );
}
