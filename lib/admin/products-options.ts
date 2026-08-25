import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Testimonial } from "@/lib/db/models/Testimonial";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * Option lists for admin dropdowns and pickers.
 *
 * Loaded once per page render and filtered client-side — these lists are tens
 * of items, so a query per keystroke would cost the M0 cluster far more than
 * it would save. Each returns an empty list if the DB is unreachable so the
 * form still renders.
 */

export interface AdminOption {
  id: string;
  name: string;
  /** Second line in the picker, e.g. a village or a category. */
  hint?: string;
}

export async function getProductOptions(): Promise<AdminOption[]> {
  try {
    await connectToDatabase();
    const docs = await Product.find()
      .select("name categoryLabel status")
      .sort({ displayOrder: 1 })
      .lean();
    return docs.map((p: LeanDoc) => ({
      id: String(p._id),
      name: p.name?.en ?? "(untitled)",
      hint:
        [p.categoryLabel?.en, p.status === "draft" ? "draft" : null]
          .filter(Boolean)
          .join(" · ") || undefined,
    }));
  } catch (error) {
    console.error("[admin] could not load product options:", error);
    return [];
  }
}

/**
 * Published testimonials only — pinning a draft would render nothing on the
 * public page, since the populate filters on status.
 */
export async function getTestimonialOptions(): Promise<AdminOption[]> {
  try {
    await connectToDatabase();
    const docs = await Testimonial.find({ status: "published" })
      .select("farmerName village district crop")
      .sort({ featured: -1, displayOrder: 1, createdAt: -1 })
      .limit(200)
      .lean();
    return docs.map((t: LeanDoc) => ({
      id: String(t._id),
      name: t.farmerName?.en ?? "(unnamed)",
      hint:
        [t.village, t.district, t.crop?.en].filter(Boolean).join(", ") ||
        undefined,
    }));
  } catch (error) {
    console.error("[admin] could not load testimonial options:", error);
    return [];
  }
}
