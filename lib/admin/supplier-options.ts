import { connectToDatabase } from "@/lib/db/connect";
import { Supplier } from "@/lib/db/models/Supplier";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * Suppliers, for the picker on a purchase or a stock item.
 *
 * The same shape as getBillableParties(): a searchable combo needs the name
 * and a hint that tells two similar names apart, which here is the GSTIN
 * and the town. Real records only — a seeded supplier under a real bill
 * would be a real purchase pointing at a record `erp-sample -- wipe` will
 * delete.
 */
export interface SupplierOption {
  id: string;
  name: string;
  hint?: string;
  gstin: string;
  state: string;
}

export async function getSupplierOptions(): Promise<SupplierOption[]> {
  try {
    await connectToDatabase();
    const docs = (await Supplier.find({ isSample: { $ne: true } })
      .select("name gstin city state")
      .sort({ name: 1 })
      .limit(2000)
      .lean()) as LeanDoc[];
    return docs.map((s) => ({
      id: String(s._id),
      name: s.name ?? "(unnamed)",
      hint: [s.gstin, s.city].filter(Boolean).join(" · ") || undefined,
      gstin: s.gstin ?? "",
      state: s.state ?? "Gujarat",
    }));
  } catch (error) {
    console.error("[admin] could not load suppliers:", error);
    return [];
  }
}
