import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { productSchema } from "@/lib/schemas";
import type { LeanDoc } from "@/lib/db/lean";
import {
  errorResponse,
  fieldErrors,
  requireAdmin,
  revalidateProduct,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** List products for the admin table: search + status filter + pagination. */
export async function GET(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = (searchParams.get("search") ?? "").trim();
    const status = searchParams.get("status") ?? "";

    const filter: LeanDoc = {};
    if (status === "draft" || status === "published") filter.status = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ "name.en": rx }, { "name.gu": rx }, { slug: rx }, { sku: rx }];
    }

    const [items, total] = await Promise.all([
      Product.find(filter)
        .select("name slug status featured categoryLabel images updatedAt displayOrder")
        .sort({ featured: -1, displayOrder: 1, updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Product.countDocuments(filter),
    ]);

    return NextResponse.json({
        items: items.map((p: LeanDoc) => ({
        id: String(p._id),
        name: p.name,
        slug: p.slug,
        status: p.status,
        featured: p.featured,
        categoryLabel: p.categoryLabel,
        image: p.images?.find((i: LeanDoc) => i.isPrimary)?.url ?? p.images?.[0]?.url ?? null,
        updatedAt: p.updatedAt,
      })),
      total,
      page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Create a product. */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const parsed = productSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Product.create(parsed.data);
    revalidateProduct(created.slug);

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
