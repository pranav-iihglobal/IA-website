import { EMPTY_PURCHASE, PurchaseForm } from "@/components/admin/PurchaseForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "New purchase" };
export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  await requirePageAccess("billing:write");

  return (
    <>
      <FormPageHeader
        backHref="/admin/purchases"
        backLabel="Purchases"
        title="New purchase"
        description="Transcribed from the supplier's bill, exactly as printed."
      />
      <div className="mt-8">
        <PurchaseForm initial={EMPTY_PURCHASE} />
      </div>
    </>
  );
}
