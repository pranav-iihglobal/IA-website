import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { recordAudit } from "@/lib/db/models/AuditLog";
import { cancelInvoiceSchema, creditNoteSchema, invoicePaymentSchema } from "@/lib/schemas";
import { InvoiceError, cancelInvoice, issueCreditNote } from "@/lib/erp/invoice";
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
  return NextResponse.json({ error: "That invoice does not exist." }, { status: 404 });
}

/** The whole document, for the detail view and the print view. */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    await connectToDatabase();
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return badId();

    return NextResponse.json({ ...invoice, id: String(invoice._id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * The only two things that may happen to an invoice after it is issued.
 *
 * Recording a payment, cancelling, and crediting. There is no edit: an issued
 * invoice is a record of what was filed, and the model refuses a financial
 * change regardless of what this route asks for.
 *
 * Crediting is the odd one out — it does not touch this invoice at all. It
 * creates a SECOND document that reverses part of it, which is exactly why
 * corrections work this way rather than by editing.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  if (!isValidObjectId(id)) return badId();

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === "cancel") {
    // Cancelling is irreversible and removes a document from the books, so it
    // needs the delete-level grant rather than write.
    const unauthorized = await requirePermission("billing:delete");
    if (unauthorized) return unauthorized;

    const parsed = cancelInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    try {
      const invoice = await cancelInvoice(id, parsed.data.reason, await currentEditor());
      return NextResponse.json({ id: String(invoice._id), status: invoice.status });
    } catch (error) {
      if (error instanceof InvoiceError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return errorResponse(error);
    }
  }

  if (action === "credit") {
    /*
      Write, not delete. A credit note ADDS a document rather than removing
      one — the original stands, which is what a filed invoice has to do —
      so it is not the irreversible act that cancelling is.
    */
    const unauthorized = await requirePermission("billing:write");
    if (unauthorized) return unauthorized;

    const parsed = creditNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    try {
      const note = await issueCreditNote(
        { invoiceId: id, reason: parsed.data.reason, lines: parsed.data.lines },
        await currentEditor(),
      );
      return NextResponse.json({ id: String(note._id), number: note.number }, { status: 201 });
    } catch (error) {
      if (error instanceof InvoiceError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return errorResponse(error);
    }
  }

  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  const parsed = invoicePaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const invoice = await Invoice.findById(id);
    if (!invoice) return badId();
    if (invoice.isHistorical) {
      return NextResponse.json(
        { error: "This invoice was already filed and is read-only here." },
        { status: 400 },
      );
    }
    /*
      Only an ISSUED invoice can be paid against. The model's lock leaves
      `payment` writable after issue — money arriving is a fact about the
      world — but it leaves it writable on a CANCELLED one too, and nothing
      here refused that: a payment could be recorded against a document that
      no longer exists on the books. The page 404s on it; the request did not.
    */
    if (invoice.status !== "issued") {
      return NextResponse.json(
        { error: `This invoice is ${invoice.status}; there is nothing to record a payment against.` },
        { status: 400 },
      );
    }
    /*
      Not a credit note. It is money going the OTHER way and is written
      `payment: paid` for its full value at issue, so "recording a payment"
      against one would overwrite that on a filed document with a figure that
      means nothing.

      This never came up while the Payment button was rendered only on
      non-credit rows — the JSX condition was doing the work. Now that every
      action is an addressable URL, the condition has to be here, where a
      request passes through, rather than where a button does not render.
    */
    if (invoice.documentType === "credit_note") {
      return NextResponse.json(
        { error: "A credit note is money going the other way. There is no payment to record against it." },
        { status: 400 },
      );
    }
    if (invoice.documentType === "sample_note") {
      return NextResponse.json(
        { error: "A sample note charged nothing. There is no payment to record against it." },
        { status: 400 },
      );
    }

    const before = { ...invoice.payment };
    // Assigned as a whole rather than field by field: `payment` is optional on
    // the inferred type, so an older document written before the sub-object
    // existed would otherwise need a null check per line.
    invoice.payment = {
      status: parsed.data.status,
      paidPaise: parsed.data.paid ?? 0,
      referenceNo: parsed.data.referenceNo,
      paidAt: parsed.data.paidAt,
    };
    // Passes the model's lock: payment is the one thing that legitimately
    // changes after issue, because money arriving is a fact about the world
    // rather than about what was filed.
    await invoice.save();

    await recordAudit({
      actor: await currentEditor(),
      action: "payment",
      entity: "Invoice",
      entityId: String(invoice._id),
      before,
      after: { ...invoice.payment },
      note: invoice.number,
    });

    return NextResponse.json({ id: String(invoice._id) });
  } catch (error) {
    return errorResponse(error);
  }
}
