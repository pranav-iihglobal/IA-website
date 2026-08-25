import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { productSchema } from "@/lib/schemas";
import { deleteAssets } from "@/lib/cloudinary";
import type { LeanDoc } from "@/lib/db/lean";
import {
  errorResponse,
  fieldErrors,
  requireAdmin,
  revalidateProduct,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Full document for the edit form (includes admin-only pricing). */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    await connectToDatabase();
    const doc = await Product.findById(id).lean();
    if (!doc) return badId();

    const { _id, __v, ...rest } = doc as LeanDoc;
    return NextResponse.json({ id: String(_id), ...rest });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    const parsed = productSchema.safeParse(await request.json());
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
    const previous = await Product.findById(id).select("slug images").lean();
    if (!previous) return badId();

    const updated = await Product.findByIdAndUpdate(id, parsed.data, {
      new: true,
      runValidators: true,
    });
    if (!updated) return badId();

    // Remove Cloudinary assets dropped from the images array.
    const keptIds = new Set(parsed.data.images.map((i: LeanDoc) => i.publicId).filter(Boolean));
    const orphaned = ((previous as LeanDoc).images ?? [])
        .map((i: LeanDoc) => i.publicId)
      .filter((pid: string) => pid && !keptIds.has(pid));
    await deleteAssets(orphaned);

    revalidateProduct(updated.slug);
    // The slug may have changed — refresh the old URL too.
    const previousSlug = (previous as LeanDoc).slug;
    if (previousSlug && previousSlug !== updated.slug) {
      revalidateProduct(previousSlug);
    }

    return NextResponse.json({ id: String(updated._id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    await connectToDatabase();
    const doc = await Product.findByIdAndDelete(id).lean();
    if (!doc) return badId();

    await deleteAssets(((doc as LeanDoc).images ?? []).map((i: LeanDoc) => i.publicId));
    revalidateProduct((doc as LeanDoc).slug);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
