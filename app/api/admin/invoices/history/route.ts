import { NextResponse, type NextRequest } from "next/server";
import { partyHistory } from "@/lib/erp/history";
import { errorResponse, requirePermission } from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Same as last time?" and "what did we charge them?"
 *
 * Fetched when a party is chosen on the invoice form, so the answers are on
 * screen before anyone types a price. Read-only and advisory — see
 * lib/erp/history.ts.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  const contactId = request.nextUrl.searchParams.get("contactId") ?? "";
  // Not an error: no party chosen yet simply means no history to show.
  if (!/^[0-9a-f]{24}$/i.test(contactId)) {
    return NextResponse.json({ lastOrder: null, prices: [] });
  }

  try {
    return NextResponse.json(await partyHistory(contactId));
  } catch (error) {
    return errorResponse(error);
  }
}
