import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/lib/db/models/Settings";
import { sellerSchema } from "@/lib/schemas";
import {
  SELLER_SETTINGS_ID,
  deriveSeller,
  sellerAuditShape,
  sellerFrom,
} from "@/lib/erp/seller";
import { getSellerSettings } from "@/lib/admin/settings";
import {
  auditChange,
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
} from "@/lib/admin/api";
import {
  bumpVersion,
  staleWriteResponse,
  versionedFilter,
} from "@/lib/admin/concurrency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Who the seller is — the one Settings document.
 *
 * Owners only (`users:manage`), like managing people: this is printed on
 * every legal document the company issues. Every save is audited with each
 * field's from → to, and version-matched so two owners editing at once
 * cannot silently overwrite each other.
 *
 * Nothing here touches an issued invoice. Each one carries its own copy.
 */
export async function GET() {
  const unauthorized = await requirePermission("users:manage");
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await getSellerSettings());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  const unauthorized = await requirePermission("users:manage");
  if (unauthorized) return unauthorized;

  try {
    const parsed = sellerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    const seller = deriveSeller(parsed.data);
    const editor = await currentEditor();

    await connectToDatabase();
    const before = await Settings.findById(SELLER_SETTINGS_ID).lean();

    let version: number;
    if (before) {
      const updated = await Settings.findOneAndUpdate(
        versionedFilter(SELLER_SETTINGS_ID, parsed.data.version),
        { ...seller, updatedBy: editor, ...bumpVersion() },
        { returnDocument: "after", runValidators: true },
      );
      // The document exists and did not match: somebody saved first.
      if (!updated) return staleWriteResponse();
      version = updated.__v;
    } else {
      try {
        const created = await Settings.create({
          _id: SELLER_SETTINGS_ID,
          ...seller,
          updatedBy: editor,
        });
        version = created.__v;
      } catch (error) {
        // Two first saves at once: the second finds the id taken.
        if ((error as { code?: number }).code === 11000) return staleWriteResponse();
        throw error;
      }
    }

    await auditChange({
      action: before ? "update" : "create",
      entity: "Settings",
      entityId: SELLER_SETTINGS_ID,
      // Flat on both sides, so the log shows the account number's own change.
      before: before ? sellerAuditShape(sellerFrom(before)) : null,
      after: sellerAuditShape(seller),
      note: "Seller details",
    });

    return NextResponse.json({ ok: true, version });
  } catch (error) {
    return errorResponse(error);
  }
}
