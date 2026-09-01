import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import { contactNoteSchema, contactSchema } from "@/lib/schemas";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("crm:read");
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await Contact.findById(id).lean();
    if (!doc) return badId();
    const { _id, __v, ...rest } = doc as LeanDoc;
    return NextResponse.json({ id: String(_id), ...rest });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("crm:write");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    const body = await request.json();

    /*
      Appending a note is a PATCH with just { note } — it is the one edit that
      must not overwrite the rest of the record. Two people logging a call at
      the same time both keep their note, because $push does not read-modify-
      write the way a full form save does.
    */
    if (body && typeof body === "object" && "note" in body) {
      const parsedNote = contactNoteSchema.safeParse(body.note);
      if (!parsedNote.success) {
        return NextResponse.json(
          { error: "Write something first", fields: fieldErrors(parsedNote.error.issues) },
          { status: 400 },
        );
      }
      await connectToDatabase();
      const author = await currentEditor();
      const updated = await Contact.findByIdAndUpdate(
        id,
        {
          $push: { notes: { body: parsedNote.data.body, author, at: new Date() } },
          $set: { lastContactAt: new Date(), updatedBy: author },
        },
        { returnDocument: "after" },
      ).lean();
      if (!updated) return badId();
      return NextResponse.json({ ok: true, notes: (updated as LeanDoc).notes ?? [] });
    }

    const parsed = contactSchema.safeParse(body);
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
    const updated = await Contact.findByIdAndUpdate(
      id,
      {
        ...parsed.data,
        /*
          Editing a seeded record makes it real. Otherwise a director fixes up
          a sample row, treats it as a customer, and the next `wipe` silently
          deletes it.
        */
        isSample: false,
        updatedBy: await currentEditor(),
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) return badId();

    return NextResponse.json({ id: String(updated._id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("crm:delete");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    /*
      An invoice snapshots its party, so deleting the contact would not break
      the document — which is exactly what makes it dangerous. It would leave
      a dangling contactId, a dead link from the invoice, and a customer whose
      trading history has nowhere to be read.

      Refused rather than cascaded. A customer with history should be kept, the
      same way the User model suspends rather than deletes.
    */
    const invoiceCount = await Invoice.countDocuments({ contactId: id });
    if (invoiceCount > 0) {
      return NextResponse.json(
        {
          error:
            `This customer has ${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"} ` +
            `against them and cannot be deleted. Their history would be orphaned.`,
        },
        { status: 409 },
      );
    }

    const doc = await Contact.findByIdAndDelete(id).lean();
    if (!doc) return badId();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
