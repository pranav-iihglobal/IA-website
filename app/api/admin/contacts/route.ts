import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { contactSchema } from "@/lib/schemas";
import type { LeanDoc } from "@/lib/db/lean";
import { toContactRow } from "@/lib/crm/shape";
import { buildFilter } from "@/lib/crm/filter";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("crm:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const filter = buildFilter(params);

    const [items, total, sampleCount] = await Promise.all([
      Contact.find(filter)
        .select(
          "contactId kind channel name businessName phone village taluka district region crop source owner followUpAt lastContactAt lead customer dealer isSample updatedAt updatedBy",
        )
        .sort({ updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Contact.countDocuments(filter),
      // Surfaced in the UI so nobody mistakes seeded rows for the real list.
      Contact.countDocuments({ ...filter, isSample: true }),
    ]);

    return NextResponse.json({
      items: (items as LeanDoc[]).map(toContactRow),
      total,
      sampleCount,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("crm:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields",
          fields: fieldErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Contact.create({
      ...parsed.data,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
