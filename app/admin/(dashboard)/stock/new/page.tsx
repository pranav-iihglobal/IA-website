import { EMPTY_STOCK, StockForm } from "@/components/admin/StockForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "New stock item" };
export const dynamic = "force-dynamic";

export default async function NewStockItemPage() {
  await requirePageAccess("billing:write");

  return (
    <>
      <FormPageHeader
        backHref="/admin/stock"
        backLabel="Stock"
        title="New stock item"
        description="Saving records a count — the date stamps itself."
      />
      <div className="mt-8">
        <StockForm initial={EMPTY_STOCK} />
      </div>
    </>
  );
}
