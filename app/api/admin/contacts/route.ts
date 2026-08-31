import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { contactSchema } from "@/lib/schemas";
import type { LeanDoc } from "@/lib/db/lean";
import { toContactRow } from "@/lib/crm/shape";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * Build the Mongo filter from the query string.
 *
 * Search deliberately does NOT use a case-insensitive regex across every
 * field: at five thousand contacts that scans the whole collection on every
 * keystroke. A phone lookup is an anchored prefix so the phone index serves
 * it; anything else goes through the text index declared on the model.
 */
function buildFilter(params: URLSearchParams): LeanDoc {
  const filter: LeanDoc = {};

  const kind = params.get("kind");
  if (kind === "lead" || kind === "customer") filter.kind = kind;

  const channel = params.get("channel");
  if (channel === "b2c" || channel === "b2b") filter.channel = channel;

  const district = params.get("district");
  if (district) filter.district = district;

  const source = params.get("source");
  if (source) filter.source = source;

  const followUpStatus = params.get("followUpStatus");
  if (followUpStatus) filter["lead.followUpStatus"] = followUpStatus;

  // The "due" view: a follow-up date that has already passed.
  if (params.get("due") === "1") {
    filter.followUpAt = { $ne: null, $lte: new Date() };
  }

  const search = (params.get("search") ?? "").trim();
  if (search) {
    const digits = search.replace(/[\s-+()]/g, "");
    if (/^\d{3,}$/.test(digits)) {
      // Anchored, so it can use the phone index rather than scanning.
      filter.phone = new RegExp(`^${digits}`);
    } else {
      filter.$text = { $search: search };
    }
  }

  return filter;
}

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("crm:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const filter = buildFilter(params);

    const [items, total, sampleCount] = await Promise.all([
      Contact.find(filter)
        .select(
          "contactId kind channel name businessName phone village taluka district region crop source owner followUpAt lastContactAt lead customer dealer isSample updatedAt updatedBy",
        )
        .sort(filter.$text ? { score: { $meta: "textScore" } } : { updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Contact.countDocuments(filter),
      // Surfaced in the UI so nobody mistakes seeded rows for the real list.
      Contact.countDocuments({ ...filter, isSample: true }),
    ]);

    return NextResponse.json({
      items: (items as LeanDoc[]).map(toContactRow),
      total,
      sampleCount,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("crm:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = contactSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields",
          fields: fieldErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Contact.create({
      ...parsed.data,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
