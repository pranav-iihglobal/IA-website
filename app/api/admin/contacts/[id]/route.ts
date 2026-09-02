import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import { contactNoteSchema, contactSchema, followUpActionSchema } from "@/lib/schemas";
import { allocateContactId, seriesChanges } from "@/lib/crm/contact-id";
import type { LeanDoc } from "@/lib/db/lean";
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

      /*
        Logged as an append rather than a diff. The note itself is the whole
        change, and diffing a growing array would record the entire call
        history on every single call.
      */
      await auditChange({
        action: "note",
        entity: "Contact",
        entityId: id,
        after: { note: parsedNote.data.body },
      });

      return NextResponse.json({ ok: true, notes: (updated as LeanDoc).notes ?? [] });
    }

    /*
      Clearing or postponing a follow-up, also a targeted $set.

      Same reasoning as the note above: the follow-up view exists to be worked
      through quickly, and a full form save from a list row would carry the
      whole record back with it — overwriting an edit somebody else made
      while the list was open, to change one date.
    */
    if (body && typeof body === "object" && "followUp" in body) {
      const parsedAction = followUpActionSchema.safeParse(body.followUp);
      if (!parsedAction.success) {
        return NextResponse.json({ error: "Unknown follow-up action" }, { status: 400 });
      }

      await connectToDatabase();
      const now = new Date();
      const editor = await currentEditor();
      const followUpAt =
        parsedAction.data.action === "done"
          ? null
          : new Date(now.getTime() + parsedAction.data.days * 86_400_000);

      const updated = await Contact.findByIdAndUpdate(
        id,
        {
          $set: {
            followUpAt,
            /*
              Only "done" means somebody spoke to them. Snoozing is deciding
              not to, and stamping it as contact would make the derived status
              say the relationship is healthy because a call was PUT OFF.
            */
            ...(parsedAction.data.action === "done" ? { lastContactAt: now } : {}),
            updatedBy: editor,
          },
        },
        { returnDocument: "after" },
      ).lean();
      if (!updated) return badId();

      await auditChange({
        action: "update",
        entity: "Contact",
        entityId: id,
        after: { followUp: parsedAction.data.action, followUpAt },
      });

      return NextResponse.json({
        ok: true,
        followUpAt: followUpAt ? followUpAt.toISOString() : null,
      });
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
    // Read first, so the audit entry holds the change rather than the record.
    const before = (await Contact.findById(id).lean()) as LeanDoc | null;
    if (!before) return badId();

    /*
      Conversion gives the record its new id.

      A lead converted to a customer moves from the L series to the C (or B)
      series, and gets the next number there — the id it carried stays on
      the record as a former id, still searchable, because it is on the
      sample register and the paperwork. This is the ONE place that sees
      both the old kind and the new, so it is where the allocation lives;
      the form never touches contactId on convert.

      A blank id on an ordinary edit is allocated too: a record from before
      allocation existed, being edited for the first time since.
    */
    const converted = seriesChanges(
      { kind: before.kind ?? "lead", channel: before.channel ?? "" },
      parsed.data,
    );
    const previousId: string = before.contactId ?? "";
    const contactId =
      converted || !parsed.data.contactId
        ? await allocateContactId(parsed.data.kind, parsed.data.channel)
        : parsed.data.contactId;
    const record = { ...parsed.data, contactId };
    const formerIds =
      converted && previousId && previousId !== contactId
        ? { $addToSet: { formerIds: previousId } }
        : {};

    /*
      Matched on the version the form loaded with, so a save cannot silently
      overwrite somebody else's. See lib/admin/concurrency.ts.
    */
    const updated = await Contact.findOneAndUpdate(
      versionedFilter(id, (parsed.data as { version?: unknown }).version),
      {
        ...record,
        /*
          Editing a seeded record makes it real. Otherwise a director fixes up
          a sample row, treats it as a customer, and the next `wipe` silently
          deletes it.
        */
        isSample: false,
        updatedBy: await currentEditor(),
        ...formerIds,
      },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) {
      return isStaleWrite(updated, before) ? staleWriteResponse() : badId();
    }

    await auditChange({
      action: "update",
      entity: "Contact",
      entityId: id,
      before: before as Record<string, unknown> | null,
      after: record as Record<string, unknown>,
    });

    return NextResponse.json({ id: String(updated._id), contactId: updated.contactId });
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
    if (doc) {
      // The only surviving record that this person was ever here.
      await auditChange({
        action: "delete",
        entity: "Contact",
        entityId: id,
        before: doc as Record<string, unknown>,
      });
    }
    if (!doc) return badId();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
