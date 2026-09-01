import { StockWorkspace, type StockRow } from "@/components/admin/StockWorkspace";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import type { LeanDoc } from "@/lib/db/lean";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const me = await requirePageAccess("billing:read");

  await connectToDatabase();
  const docs = await StockItem.find().sort({ name: 1 }).limit(500).lean();

  const items: StockRow[] = (docs as LeanDoc[]).map((d) => ({
    id: String(d._id),
    name: d.name ?? "",
    sku: d.sku ?? "",
    kind: d.kind ?? "finished",
    unit: d.unit ?? "unit",
    onHand: d.onHand ?? 0,
    reorderLevel: d.reorderLevel ?? 0,
    unitCostPaise: d.unitCostPaise ?? 0,
    supplier: d.supplier ?? "",
    location: d.location ?? "",
    notes: d.notes ?? "",
    countedAt: d.countedAt ? new Date(d.countedAt).toISOString() : null,
    isSample: Boolean(d.isSample),
  }));

  return (
    <StockWorkspace
      initialItems={items}
      canWrite={can(me, "billing:write")}
      canDelete={can(me, "billing:delete")}
    />
  );
}
