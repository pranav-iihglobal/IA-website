import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { parseVideoEmbedId, testimonialSchema } from "@/lib/schemas";
import type { LeanDoc } from "@/lib/db/lean";
import { searchRegex } from "@/lib/search";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  revalidateTestimonials,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("testimonials:read");
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
      const rx = searchRegex(search);
      filter.$or = [
        { "farmerName.en": rx },
        { "farmerName.gu": rx },
        { village: rx },
        { district: rx },
      ];
    }

    const [items, total] = await Promise.all([
      Testimonial.find(filter)
        .select(
          "farmerName village district crop status featured photo video displayOrder updatedAt updatedBy verified verifiedVia source",
        )
        .sort({ featured: -1, displayOrder: 1, updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Testimonial.countDocuments(filter),
    ]);

    return NextResponse.json({
      items: items.map((t: LeanDoc) => ({
        id: String(t._id),
        farmerName: t.farmerName,
        village: t.village,
        district: t.district,
        crop: t.crop,
        status: t.status,
        featured: t.featured,
        photo: t.photo?.url ?? null,
        videoPlatform: t.video?.platform ?? "",
        verified: Boolean(t.verified),
        verifiedVia: t.verifiedVia ?? "",
        source: t.source ?? "admin_entered",
        updatedAt: t.updatedAt,
        updatedBy: t.updatedBy ?? "",
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("testimonials:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = testimonialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields",
          fields: fieldErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    // Derive the embed id server-side so the stored value is always trusted.
    const data = { ...parsed.data };
    if (data.video.url && data.video.platform) {
      data.video.embedId =
        parseVideoEmbedId(data.video.platform, data.video.url) ?? "";
    }

    await connectToDatabase();
    const created = await Testimonial.create({
      ...data,
      updatedBy: await currentEditor(),
    });
    revalidateTestimonials();

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
