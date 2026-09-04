import { NextResponse, type NextRequest } from "next/server";
import { issueInvoiceSchema } from "@/lib/schemas";
import { InvoiceError, issueInvoice } from "@/lib/erp/invoice";
import { StockShortageError } from "@/lib/erp/stock-moves";
import { exportInvoices, listInvoices } from "@/lib/erp/list";
import { INVOICE_EXPORT_HEADERS, invoiceExportRow } from "@/lib/erp/export";
import { EXPORT_READ, csvResponse } from "@/lib/admin/csv-response";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    // The list as a file, same filter and sort. See contacts/route.ts.
    if (params.get("format") === "csv") {
      const rows = await exportInvoices(params, EXPORT_READ);
      return csvResponse("invoices", INVOICE_EXPORT_HEADERS, rows.map(invoiceExportRow));
    }
    return NextResponse.json(await listInvoices(params));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Raise an invoice.
 *
 * There is no "create a draft" path yet, deliberately: an invoice number is
 * allocated at issue, and until there is a real need for drafts, one endpoint
 * that always produces a numbered document is one fewer state to reason about.
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = issueInvoiceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields",
          fields: fieldErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    const invoice = await issueInvoice(
      {
        contactId: parsed.data.contactId,
        lines: parsed.data.lines.map((l) => ({
          productId: l.productId,
          packLabel: l.packLabel,
          quantity: l.quantity,
          uom: l.uom,
          unitPricePaise: l.unitPrice ?? 0,
          discountType: l.discountType,
          discountValue:
            l.discountType === "percent" ? (l.discountPercent ?? 0) : (l.discount ?? 0),
        })),
        placeOfSupplyStateCode: parsed.data.placeOfSupplyStateCode,
        notes: parsed.data.notes,
      },
      await currentEditor(),
    );

    return NextResponse.json(
      { id: String(invoice._id), number: invoice.number },
      { status: 201 },
    );
  } catch (error) {
    /*
      An InvoiceError is a message written for the person raising the invoice —
      "FloraMax has no GST rate set" — not an internal fault. It is a 400 with
      that text, rather than a 500 that says "something went wrong" about a
      problem they can fix in thirty seconds.
    */
    // A stock shortage names the line, so the form can put it under the field.
    if (error instanceof StockShortageError) {
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: 400 });
    }
    if (error instanceof InvoiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
