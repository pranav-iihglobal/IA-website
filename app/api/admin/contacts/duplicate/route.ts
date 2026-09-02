import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { duplicatePhoneFilter, phoneKey } from "@/lib/crm/duplicates";
import { errorResponse, requirePermission } from "@/lib/admin/api";
import type { LeanDoc } from "@/lib/db/lean";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Does anybody already have this number?"
 *
 * Its own route rather than a search against the list, because the duplicate
 * that matters most is the one in a DIFFERENT scope — adding a customer who
 * is already on file as a lead. The list endpoint is scoped to the screen it
 * serves and would miss exactly that case.
 *
 * Read-only, gated on crm:read, and it returns at most a handful of names.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("crm:read");
  if (unauthorized) return unauthorized;

  const params = request.nextUrl.searchParams;
  const filter = duplicatePhoneFilter(
    phoneKey(params.get("phone") ?? ""),
    params.get("exclude") ?? undefined,
  );
  // Not an error: a half-typed number simply has no twins yet.
  if (!filter) return NextResponse.json({ matches: [] });

  try {
    await connectToDatabase();
    const docs = (await Contact.find(filter)
      .select("name businessName contactId kind channel village district phone")
      .limit(5)
      .lean()) as LeanDoc[];

    return NextResponse.json({
      matches: docs.map((d) => ({
        id: String(d._id),
        name: d.businessName || d.name || "",
        contactId: d.contactId ?? "",
        kind: d.kind === "lead" ? "Lead" : d.channel === "b2b" ? "Dealer" : "Customer",
        place: [d.village, d.district].filter(Boolean).join(", "),
        phone: d.phone ?? "",
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
