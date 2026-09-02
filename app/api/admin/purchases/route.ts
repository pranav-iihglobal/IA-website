import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import { exportPurchases, listPurchases } from "@/lib/erp/inventory-list";
import { PURCHASE_EXPORT_HEADERS, purchaseExportRow } from "@/lib/erp/export";
import { EXPORT_READ, csvResponse } from "@/lib/admin/csv-response";
import { purchaseSchema } from "@/lib/schemas";
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
    const params = request.nextUrl.searchParams;
    // The list as a file, same filter and sort. See contacts/route.ts.
    if (params.get("format") === "csv") {
      const rows = await exportPurchases(params, EXPORT_READ);
      return csvResponse("purchases", PURCHASE_EXPORT_HEADERS, rows.map(purchaseExportRow));
    }
    // Rows paged, totals over everything — see lib/erp/inventory-list.ts.
    return NextResponse.json(await listPurchases(params));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Purchase.create({
      ...parsed.data,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });
    await auditChange({
      action: "create",
      entity: "Purchase",
      entityId: String(created._id),
      after: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
