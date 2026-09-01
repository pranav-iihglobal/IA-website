import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/admin/api";
import { invoicesForPeriod } from "@/lib/erp/reports";
import { b2bCsv, b2csCsv, buildGstReturn } from "@/lib/erp/gst";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The GSTR-1 sections, as CSV the CA can open.
 *
 * A download rather than a screen scrape: this is the artefact that leaves the
 * app and goes to somebody else, so it is generated in one place from the same
 * function the on-screen tables use.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    const params = request.nextUrl.searchParams;
    const now = new Date();
    const year = Number(params.get("year")) || now.getFullYear();
    const month = Number(params.get("month")) || now.getMonth() + 1;
    const section = params.get("section") === "b2cs" ? "b2cs" : "b2b";

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Month must be 1–12." }, { status: 400 });
    }

    const built = buildGstReturn(await invoicesForPeriod(year, month));
    const csv = section === "b2b" ? b2bCsv(built.b2b) : b2csCsv(built.b2cs);
    const stamp = `${year}-${String(month).padStart(2, "0")}`;

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="gstr1-${section}-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
