import { NextResponse, type NextRequest } from "next/server";
import { issueSampleNoteSchema } from "@/lib/schemas";
import { InvoiceError } from "@/lib/erp/invoice-error";
import { issueSampleNote } from "@/lib/erp/sample-note";
import { StockShortageError } from "@/lib/erp/stock-moves";
import { currentEditor, errorResponse, fieldErrors, requirePermission } from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Give a sample. One endpoint that always produces a numbered sample note,
 * for the same reason invoices have no draft path — see invoices/route.ts.
 * Gated like an invoice: it moves stock and it is a document.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = issueSampleNoteSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    const note = await issueSampleNote(
      {
        contactId: parsed.data.contactId,
        lines: parsed.data.lines,
        notes: parsed.data.notes,
      },
      await currentEditor(),
    );

    return NextResponse.json({ id: String(note._id), number: note.number }, { status: 201 });
  } catch (error) {
    if (error instanceof StockShortageError) {
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    }
    if (error instanceof InvoiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
