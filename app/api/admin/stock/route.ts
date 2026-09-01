import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { stockItemSchema } from "@/lib/schemas";
import { searchRegex } from "@/lib/search";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const filter: LeanDoc = {};

    const search = (params.get("search") ?? "").trim();
    if (search) {
      const rx = searchRegex(search);
      filter.$or = ["name", "sku", "supplier", "location"].map((f) => ({ [f]: rx }));
    }

    const items = await StockItem.find(filter).sort({ name: 1 }).limit(500).lean();
    return NextResponse.json({
      // Mapped, not spread — same reason as the purchases list.
      items: (items as LeanDoc[]).map((d) => ({
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
      })),
      total: items.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = stockItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await StockItem.create({
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
