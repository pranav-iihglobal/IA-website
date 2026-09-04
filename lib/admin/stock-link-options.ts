import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * What a stock item can be linked to: every product, with its pack labels.
 *
 * The link is by product id AND pack label, because a product is sold in
 * several packs and each pack is its own shelf. Loaded once per page like
 * the other option lists; three products is not a query worth debouncing.
 */
export interface StockLinkOption {
  id: string;
  name: string;
  packs: string[];
}

export async function getStockLinkOptions(): Promise<StockLinkOption[]> {
  try {
    await connectToDatabase();
    const docs = await Product.find()
      .select("name packSizes displayOrder")
      .sort({ displayOrder: 1 })
      .lean();
    return docs.map((p: LeanDoc) => ({
      id: String(p._id),
      name: p.name?.en ?? "(untitled)",
      packs: ((p.packSizes ?? []) as LeanDoc[])
        .map((pack) => String(pack.label ?? "").trim())
        .filter(Boolean),
    }));
  } catch (error) {
    console.error("[admin] could not load stock link options:", error);
    return [];
  }
}
