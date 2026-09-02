import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Supplier } from "@/lib/db/models/Supplier";
import { supplierSchema } from "@/lib/schemas";
import { listSuppliers } from "@/lib/erp/suppliers";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Suppliers sit with Stock and Purchases, so they share the billing gate. */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await listSuppliers(request.nextUrl.searchParams));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Supplier.create({
      ...parsed.data,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });
    await auditChange({
      action: "create",
      entity: "Supplier",
      entityId: String(created._id),
      after: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json(
      { id: String(created._id), name: created.name, gstin: created.gstin ?? "" },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
