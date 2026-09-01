import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import { issueInvoiceSchema } from "@/lib/schemas";
import { InvoiceError, issueInvoice } from "@/lib/erp/invoice";
import { searchRegex } from "@/lib/search";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));

    const filter: LeanDoc = {};
    const status = params.get("status");
    if (status === "issued" || status === "cancelled" || status === "draft") {
      filter.status = status;
    }
    const year = params.get("financialYear");
    if (year) filter.financialYear = year;
    const payment = params.get("payment");
    if (payment) filter["payment.status"] = payment;

    const search = (params.get("search") ?? "").trim();
    if (search) {
      const rx = searchRegex(search);
      filter.$or = [{ number: rx }, { "party.name": rx }, { "party.businessName": rx }];
    }

    const [items, total] = await Promise.all([
      Invoice.find(filter)
        .select(
          "number financialYear status issuedAt party grandTotalPaise payment isHistorical cancelledAt",
        )
        // Newest first, and drafts (no issuedAt) at the top where they need acting on.
        .sort({ issuedAt: -1, createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    return NextResponse.json({
      items: (items as LeanDoc[]).map((i) => ({
        id: String(i._id),
        number: i.number ?? "",
        financialYear: i.financialYear ?? "",
        status: i.status,
        issuedAt: i.issuedAt ? new Date(i.issuedAt).toISOString() : null,
        partyName: i.party?.businessName || i.party?.name || "",
        gstin: i.party?.gstin ?? "",
        grandTotalPaise: i.grandTotalPaise ?? 0,
        paymentStatus: i.payment?.status ?? "unpaid",
        isHistorical: Boolean(i.isHistorical),
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      pageSize: PAGE_SIZE,
    });
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
          unitPricePaise: l.unitPrice ?? 0,
          discountPaise: l.discount ?? 0,
        })),
        placeOfSupplyStateCode: parsed.data.placeOfSupplyStateCode,
        transportPaise: parsed.data.transport ?? 0,
        transportCharged: parsed.data.transportCharged,
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
    if (error instanceof InvoiceError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error);
  }
}
