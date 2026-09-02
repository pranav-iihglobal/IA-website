import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { StockForm, type StockFormValues } from "@/components/admin/StockForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { paiseToRupeeString } from "@/lib/money";
import { formatIstDateLong } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Edit stock item" };
export const dynamic = "force-dynamic";

function toFormValues(doc: LeanDoc): StockFormValues {
  return {
    name: doc.name ?? "",
    sku: doc.sku ?? "",
    kind: doc.kind ?? "finished",
    unit: doc.unit ?? "unit",
    onHand: String(doc.onHand ?? 0),
    reorderLevel: String(doc.reorderLevel ?? 0),
    // paiseToRupeeString, not String(paise / 100): the latter reads 105050
    // paise back as "1050.5" rather than "1050.50", on a money field.
    unitCost: doc.unitCostPaise ? paiseToRupeeString(doc.unitCostPaise) : "",
    supplier: doc.supplier ?? "",
    location: doc.location ?? "",
    notes: doc.notes ?? "",
  };
}

export default async function EditStockItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = (await StockItem.findById(id).lean()) as LeanDoc | null;
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref={`/admin/stock/${id}`}
        backLabel={doc.name ?? "Stock"}
        title={<>Count {doc.name}</>}
        description={
          doc.countedAt
            ? `Last counted ${formatIstDateLong(new Date(doc.countedAt))}.`
            : "Never counted through this system."
        }
      />
      <div className="mt-8">
        <StockForm
          initial={toFormValues(doc)}
          itemId={id}
          /* Sent back on save, so a count taken on one phone cannot silently
             erase one taken on another. */
          version={typeof doc.__v === "number" ? doc.__v : 0}
        />
      </div>
    </>
  );
}
