import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Scheme } from "@/lib/db/models/Scheme";
import { Invoice } from "@/lib/db/models/Invoice";
import { schemeSchema } from "@/lib/schemas";
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
  return NextResponse.json({ error: "That scheme does not exist." }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await Scheme.findById(id).lean();
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

    const parsed = schemeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const before = await Scheme.findById(id).lean();
    /*
      Version-matched like every record two people can edit. Invoices already
      issued under this scheme keep the discount they were issued with — the
      line snapshots the amount and the scheme's name; this changes the rule
      for what is issued from now on.
    */
    const updated = await Scheme.findOneAndUpdate(
      versionedFilter(id, (parsed.data as { version?: unknown }).version),
      { ...parsed.data, updatedBy: await currentEditor(), ...bumpVersion() },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      const exists = await Scheme.exists({ _id: id });
      return isStaleWrite(updated, exists) ? staleWriteResponse() : badId();
    }

    await auditChange({
      action: "update",
      entity: "Scheme",
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
      A scheme that has been applied is part of filed documents — the lines
      carry its name and amount, so nothing breaks — but "why did this
      invoice have 10% off" should still have a record to open. Switch it off
      instead; it costs nothing to keep.
    */
    const used = await Invoice.countDocuments({ "lines.schemeId": id });
    if (used > 0) {
      return NextResponse.json(
        {
          error: `This scheme was applied on ${used} invoice${used === 1 ? "" : "s"} and cannot be deleted. Switch it off instead.`,
        },
        { status: 409 },
      );
    }

    const deleted = await Scheme.findByIdAndDelete(id);
    if (!deleted) return badId();

    await auditChange({
      action: "delete",
      entity: "Scheme",
      entityId: id,
      before: deleted.toObject() as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
