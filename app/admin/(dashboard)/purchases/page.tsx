import { PurchaseWorkspace, type PurchaseRow } from "@/components/admin/PurchaseWorkspace";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import type { LeanDoc } from "@/lib/db/lean";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const me = await requirePageAccess("billing:read");

  await connectToDatabase();
  const docs = await Purchase.find().sort({ billDate: -1 }).limit(500).lean();

  const items: PurchaseRow[] = (docs as LeanDoc[]).map((d) => ({
    id: String(d._id),
    supplier: d.supplier ?? "",
    supplierGstin: d.supplierGstin ?? "",
    billNo: d.billNo ?? "",
    billDate: d.billDate ? new Date(d.billDate).toISOString() : null,
    category: d.category ?? "other",
    description: d.description ?? "",
    taxableValuePaise: d.taxableValuePaise ?? 0,
    cgstPaise: d.cgstPaise ?? 0,
    sgstPaise: d.sgstPaise ?? 0,
    igstPaise: d.igstPaise ?? 0,
    totalPaise: d.totalPaise ?? 0,
    inputCreditEligible: Boolean(d.inputCreditEligible),
    paidBy: d.paidBy ?? "company",
    paidByName: d.paidByName ?? "",
    paymentStatus: d.paymentStatus ?? "unpaid",
    paidPaise: d.paidPaise ?? 0,
    notes: d.notes ?? "",
  }));

  return (
    <PurchaseWorkspace
      initialItems={items}
      canWrite={can(me, "billing:write")}
      canDelete={can(me, "billing:delete")}
    />
  );
}
