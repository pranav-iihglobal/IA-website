import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import { purchaseSchema } from "@/lib/schemas";
import { supplierSnapshot } from "@/lib/erp/suppliers";
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
  bumpVersion,
} from "@/lib/admin/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "That purchase does not exist." }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await Purchase.findById(id).lean();
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

    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    // The supplier's name and GSTIN from the RECORD — see purchases/route.ts.
    const snapshot = parsed.data.supplierId ? await supplierSnapshot(parsed.data.supplierId) : null;
    if (parsed.data.supplierId && !snapshot) {
      return NextResponse.json(
        { error: "That supplier no longer exists. Pick another.", fields: { supplierId: "Pick a supplier from the list" } },
        { status: 400 },
      );
    }
    const record = { ...parsed.data, ...(snapshot ?? { supplierId: null }) };

    // Read first, so the audit entry can say what actually changed rather
    // than restating the whole document.
    const before = await Purchase.findById(id).lean();
    /*
      Version-matched: a save must not silently overwrite one made
      while this form was open. See lib/admin/concurrency.ts.
    */
    const updated = await Purchase.findOneAndUpdate(
      versionedFilter(id, (parsed.data as { version?: unknown }).version),
      { ...record, updatedBy: await currentEditor(), ...bumpVersion() },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      // Missing, or someone saved first? The two need different answers.
      const exists = await Purchase.exists({ _id: id });
      return isStaleWrite(updated, exists) ? staleWriteResponse() : badId();
    }

    await auditChange({
      action: "update",
      entity: "Purchase",
      entityId: id,
      before: before as Record<string, unknown> | null,
      after: record as Record<string, unknown>,
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
    const deleted = await Purchase.findByIdAndDelete(id);
    if (!deleted) return badId();

    /*
      The deleted document goes in as `before` with no `after`. It is the only
      record that it ever existed — the row is gone and the log is append-only,
      so this entry is the whole history.
    */
    await auditChange({
      action: "delete",
      entity: "Purchase",
      entityId: id,
      before: deleted.toObject() as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
