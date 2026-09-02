import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { StockItem } from "@/lib/db/models/StockItem";
import { stockItemSchema } from "@/lib/schemas";
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
  return NextResponse.json({ error: "That stock item does not exist." }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await StockItem.findById(id).lean();
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

    const parsed = stockItemSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    // Read first, so the audit entry can say what actually changed rather
    // than restating the whole document.
    const before = await StockItem.findById(id).lean();
    /*
      Version-matched: a save must not silently overwrite one made
      while this form was open. See lib/admin/concurrency.ts.
    */
    const updated = await StockItem.findOneAndUpdate(
      versionedFilter(id, (parsed.data as { version?: unknown }).version),
      { ...parsed.data, updatedBy: await currentEditor() },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      // Missing, or someone saved first? The two need different answers.
      const exists = await StockItem.exists({ _id: id });
      return isStaleWrite(updated, exists) ? staleWriteResponse() : badId();
    }

    await auditChange({
      action: "update",
      entity: "StockItem",
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
    const deleted = await StockItem.findByIdAndDelete(id);
    if (!deleted) return badId();

    /*
      The deleted document goes in as `before` with no `after`. It is the only
      record that it ever existed — the row is gone and the log is append-only,
      so this entry is the whole history.
    */
    await auditChange({
      action: "delete",
      entity: "StockItem",
      entityId: id,
      before: deleted.toObject() as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
