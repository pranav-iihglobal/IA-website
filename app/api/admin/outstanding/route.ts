import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { errorResponse, requirePermission } from "@/lib/admin/api";
import { outstandingInvoices } from "@/lib/erp/reports";
import { OUTSTANDING_EXPORT_HEADERS, outstandingExportRow } from "@/lib/erp/export";
import { EXPORT_READ, csvResponse } from "@/lib/admin/csv-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who owes what, as a file.
 *
 * The Outstanding screens are server components with no list API of their
 * own, so this exists for the export alone. Same pipeline as the screen, so
 * "Owed" is net of credit notes here too; `contactId` narrows it to one
 * customer, the way their own outstanding page does.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    if (params.get("format") !== "csv") {
      return NextResponse.json({ error: "Add format=csv" }, { status: 400 });
    }
    const sort = params.get("sort") === "largest" ? "largest" : "oldest";
    const contactId = params.get("contactId");
    const rows = await outstandingInvoices(
      sort,
      contactId && isValidObjectId(contactId) ? contactId : undefined,
      EXPORT_READ,
    );
    return csvResponse("outstanding", OUTSTANDING_EXPORT_HEADERS, rows.map(outstandingExportRow));
  } catch (error) {
    return errorResponse(error);
  }
}
