import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * Product options for admin dropdowns (e.g. linking a testimonial to the
 * product a farmer used). Returns an empty list if the DB is unreachable so
 * the form still renders.
 */
export async function getProductOptions(): Promise<
  { id: string; name: string }[]
> {
  try {
    await connectToDatabase();
    const docs = await Product.find().select("name").sort({ displayOrder: 1 }).lean();
    return docs.map((p: LeanDoc) => ({
      id: String(p._id),
      name: p.name?.en ?? "(untitled)",
    }));
  } catch (error) {
    console.error("[admin] could not load product options:", error);
    return [];
  }
}
