import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { exportStock, listStock } from "@/lib/erp/inventory-list";
import { STOCK_EXPORT_HEADERS, stockExportRow } from "@/lib/erp/export";
import { EXPORT_READ, csvResponse } from "@/lib/admin/csv-response";
import { stockItemSchema } from "@/lib/schemas";
import { supplierSnapshot } from "@/lib/erp/suppliers";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  The partial unique index on StockItem (one item per product pack) refuses
  a second link with E11000. That is a person's mistake with a plain answer,
  not a fault: 409, naming what to do.
*/
function isDuplicateLink(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000 &&
    String((error as { message?: unknown }).message ?? "").includes("one_item_per_pack")
  );
}

function duplicateLink() {
  return NextResponse.json(
    {
      error: "Another stock item is already linked to that pack. Unlink it first, or pick a different pack.",
      fields: { packLabel: "Already linked to another item" },
    },
    { status: 409 },
  );
}

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    // The list as a file, same filter and sort. See contacts/route.ts.
    if (params.get("format") === "csv") {
      const rows = await exportStock(params, EXPORT_READ);
      return csvResponse("stock", STOCK_EXPORT_HEADERS, rows.map(stockExportRow));
    }
    // Rows paged, totals over everything — see lib/erp/inventory-list.ts.
    return NextResponse.json(await listStock(params));
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
    // The supplier's name from the record, when one is picked.
    const snapshot = parsed.data.supplierId ? await supplierSnapshot(parsed.data.supplierId) : null;
    if (parsed.data.supplierId && !snapshot) {
      return NextResponse.json(
        { error: "That supplier no longer exists. Pick another.", fields: { supplierId: "Pick a supplier from the list" } },
        { status: 400 },
      );
    }
    const created = await StockItem.create({
      ...parsed.data,
      ...(snapshot
        ? { supplierId: snapshot.supplierId, supplier: snapshot.supplier }
        : { supplierId: null }),
      // Blank means unlinked; the model wants null, not "".
      productId: parsed.data.productId || null,
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
    if (isDuplicateLink(error)) return duplicateLink();
    return errorResponse(error);
  }
}
