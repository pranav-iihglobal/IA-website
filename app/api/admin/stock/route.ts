import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { listStock } from "@/lib/erp/inventory-list";
import { stockItemSchema } from "@/lib/schemas";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    // Rows paged, totals over everything — see lib/erp/inventory-list.ts.
    return NextResponse.json(await listStock(request.nextUrl.searchParams));
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
    await auditChange({
      action: "create",
      entity: "StockItem",
      entityId: String(created._id),
      after: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
