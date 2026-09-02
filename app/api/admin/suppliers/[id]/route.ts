import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Supplier } from "@/lib/db/models/Supplier";
import { supplierSchema } from "@/lib/schemas";
import { supplierReferences } from "@/lib/erp/suppliers";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";
import {
  isStaleWrite,
  staleWriteResponse,
  versionedFilter,
} from "@/lib/admin/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "That supplier does not exist." }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await Supplier.findById(id).lean();
    if (!doc) return badId();
    return NextResponse.json({ ...doc, id: String(doc._id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    const parsed = supplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const before = await Supplier.findById(id).lean();
    /*
      Version-matched, like every record two people can edit. The bills
      already entered keep their own snapshot of the name and GSTIN — this
      changes the record, not history.
    */
    const updated = await Supplier.findOneAndUpdate(
      versionedFilter(id, (parsed.data as { version?: unknown }).version),
      { ...parsed.data, updatedBy: await currentEditor() },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      const exists = await Supplier.exists({ _id: id });
      return isStaleWrite(updated, exists) ? staleWriteResponse() : badId();
    }

    await auditChange({
      action: "update",
      entity: "Supplier",
      entityId: id,
      before: before as Record<string, unknown> | null,
      after: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json({ id: String(updated._id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:delete");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();

    /*
      Refused rather than cascaded, the way a product on an invoice or a
      customer with bills is. The purchases would keep their snapshot and
      still read correctly — which is exactly what makes a dangling reference
      dangerous: nothing would look wrong.
    */
    const refs = await supplierReferences(id);
    if (refs.purchases > 0 || refs.stock > 0) {
      const parts = [
        refs.purchases > 0 ? `${refs.purchases} purchase${refs.purchases === 1 ? "" : "s"}` : "",
        refs.stock > 0 ? `${refs.stock} stock item${refs.stock === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      return NextResponse.json(
        {
          error: `This supplier is on ${parts.join(" and ")} and cannot be deleted. Correct the record instead.`,
        },
        { status: 409 },
      );
    }

    const deleted = await Supplier.findByIdAndDelete(id);
    if (!deleted) return badId();

    await auditChange({
      action: "delete",
      entity: "Supplier",
      entityId: id,
      before: deleted.toObject() as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
