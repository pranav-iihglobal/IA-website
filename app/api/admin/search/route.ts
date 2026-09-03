import { NextResponse, type NextRequest } from "next/server";
import { currentUser, errorResponse } from "@/lib/admin/api";
import { globalSearch } from "@/lib/admin/global-search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The one search box. Signed in is the only gate here; which sections come
 * back is decided per section inside globalSearch(), by the viewer's access.
 */
export async function GET(request: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const sections = await globalSearch(q, { role: me.role, modules: me.modules });
    return NextResponse.json({ sections });
  } catch (error) {
    return errorResponse(error);
  }
}
