import { NextResponse, type NextRequest } from "next/server";
import { requirePermission, errorResponse } from "@/lib/admin/api";
import { invoicesForPeriod } from "@/lib/erp/reports";
import { istParts } from "@/lib/time";
import {
  b2bCsv,
  b2csCsv,
  buildGstReturn,
  buildHsnSummary,
  cdnCsv,
  hsnCsv,
} from "@/lib/erp/gst";

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
    // The current month in IST — the download must default to the same period
    // the screen is showing, and the screen reckons in IST.
    const today = istParts(new Date());
    const year = Number(params.get("year")) || today.year;
    const month = Number(params.get("month")) || today.month;
    const requested = params.get("section") ?? "";
    const section = (
      ["b2cs", "hsn", "cdnr", "cdnur"].includes(requested) ? requested : "b2b"
    ) as "b2b" | "b2cs" | "hsn" | "cdnr" | "cdnur";

    if (month < 1 || month > 12) {
      return NextResponse.json({ error: "Month must be 1–12." }, { status: 400 });
    }

    const invoices = await invoicesForPeriod(year, month);
    const built = buildGstReturn(invoices);
    const csv =
      section === "hsn"
        ? hsnCsv(buildHsnSummary(invoices))
        : section === "b2cs"
          ? b2csCsv(built.b2cs)
          : section === "cdnr"
            ? cdnCsv(built.cdnr, true)
            : section === "cdnur"
              ? cdnCsv(built.cdnur, false)
              : b2bCsv(built.b2b);
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
