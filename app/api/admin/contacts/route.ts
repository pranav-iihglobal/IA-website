import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { contactSchema } from "@/lib/schemas";
import { exportContacts, listContacts } from "@/lib/crm/list";
import { allocateContactId } from "@/lib/crm/contact-id";
import { CONTACT_EXPORT_HEADERS, contactExportRow } from "@/lib/crm/export";
import { EXPORT_READ, csvResponse } from "@/lib/admin/csv-response";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The list, for searching, filtering and paging.
 *
 * The FIRST page no longer comes through here — the page renders it on the
 * server and ships the rows in the HTML. This serves every query after that.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("crm:read");
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    /*
      The same filter and sort as the list, as a file. Rides on crm:read —
      there is no export level, and the list is already on this person's
      screen; a CSV of it is the same information in a form they can keep.
    */
    if (params.get("format") === "csv") {
      const rows = await exportContacts(params, EXPORT_READ);
      const name = params.get("kind") === "lead" ? "leads" : params.get("channel") === "b2b" ? "dealers" : "customers";
      return csvResponse(name, CONTACT_EXPORT_HEADERS, rows.map(contactExportRow));
    }
    return NextResponse.json(await listContacts(params));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("crm:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = contactSchema.safeParse(await request.json());
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
    /*
      Blank means allocate. The id comes from the atomic Counter, in the
      series for this kind of contact, so two people saving a lead at once
      get two ids — see lib/crm/contact-id.ts. A typed id is kept as typed:
      it is what is on their paperwork.
    */
    const contactId =
      parsed.data.contactId ||
      (await allocateContactId(parsed.data.kind, parsed.data.channel));
    const record = { ...parsed.data, contactId };

    const created = await Contact.create({
      ...record,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });

    await auditChange({
      action: "create",
      entity: "Contact",
      entityId: String(created._id),
      // `record`, not `parsed.data`: the allocated id must be in the log.
      after: record as Record<string, unknown>,
    });

    return NextResponse.json(
      { id: String(created._id), contactId: created.contactId },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
