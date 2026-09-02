import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import { purchaseSchema } from "@/lib/schemas";
import { searchRegex } from "@/lib/search";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  auditChange,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("billing:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const params = request.nextUrl.searchParams;
    const filter: LeanDoc = {};

    const search = (params.get("search") ?? "").trim();
    if (search) {
      const rx = searchRegex(search);
      filter.$or = ["supplier", "billNo", "description", "supplierGstin"].map((f) => ({ [f]: rx }));
    }

    const items = await Purchase.find(filter).sort({ billDate: -1 }).limit(500).lean();
    return NextResponse.json({
      /*
        Mapped field by field, not spread. A spread ships _id, __v and whatever
        else the model grows next — every other list here is explicit, and this
        was the one that would quietly expose a field added later.
      */
      items: (items as LeanDoc[]).map((d) => ({
        id: String(d._id),
        version: typeof d.__v === "number" ? d.__v : 0,
        supplier: d.supplier ?? "",
        supplierGstin: d.supplierGstin ?? "",
        billNo: d.billNo ?? "",
        billDate: d.billDate ? new Date(d.billDate).toISOString() : null,
        category: d.category ?? "other",
        description: d.description ?? "",
        taxableValuePaise: d.taxableValuePaise ?? 0,
        cgstPaise: d.cgstPaise ?? 0,
        sgstPaise: d.sgstPaise ?? 0,
        igstPaise: d.igstPaise ?? 0,
        totalPaise: d.totalPaise ?? 0,
        inputCreditEligible: Boolean(d.inputCreditEligible),
        paidBy: d.paidBy ?? "company",
        paidByName: d.paidByName ?? "",
        paymentStatus: d.paymentStatus ?? "unpaid",
        paidPaise: d.paidPaise ?? 0,
        notes: d.notes ?? "",
      })),
      total: items.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("billing:write");
  if (unauthorized) return unauthorized;

  try {
    const parsed = purchaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please fix the highlighted fields", fields: fieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const created = await Purchase.create({
      ...parsed.data,
      // Never trusted from the client — anything created here is real.
      isSample: false,
      updatedBy: await currentEditor(),
    });
    await auditChange({
      action: "create",
      entity: "Purchase",
      entityId: String(created._id),
      after: parsed.data as Record<string, unknown>,
    });

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
