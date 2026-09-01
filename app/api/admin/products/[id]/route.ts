import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { productSchema } from "@/lib/schemas";
import { deleteTypedAssets } from "@/lib/cloudinary";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  revalidateProduct,
} from "@/lib/admin/api";

/**
 * Every Cloudinary public_id a product document references, with the resource
 * type each was uploaded as. Used to spot assets dropped by an edit, and to
 * clean up everything when a product is deleted.
 */
function referencedAssets(
  doc: LeanDoc,
): { publicId: string; resourceType: "image" | "raw" }[] {
  const out: { publicId: string; resourceType: "image" | "raw" }[] = [];
  const image = (publicId?: string) => {
    if (publicId) out.push({ publicId, resourceType: "image" });
  };

  for (const img of doc.images ?? []) image(img.publicId);
  for (const step of doc.applicationSteps ?? []) image(step.image?.publicId);
  for (const result of doc.fieldResults ?? []) {
    image(result.beforeImage?.publicId);
    image(result.afterImage?.publicId);
  }
  for (const asset of doc.assets ?? []) {
    if (asset.publicId) {
      out.push({
        publicId: asset.publicId,
        resourceType: asset.resourceType ?? "raw",
      });
    }
  }
  return out;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/** Full document for the edit form (includes admin-only pricing). */
export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requirePermission("products:read");
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
  const unauthorized = await requirePermission("products:write");
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
    const previous = await Product.findById(id)
      .select("slug images applicationSteps fieldResults assets")
      .lean();
    if (!previous) return badId();

    const updated = await Product.findByIdAndUpdate(
      id,
      { ...parsed.data, updatedBy: await currentEditor() },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) return badId();

    // Remove Cloudinary assets this edit dropped — images and PDFs alike.
    const kept = new Set(
      referencedAssets(updated.toObject() as LeanDoc).map((a) => a.publicId),
    );
    await deleteTypedAssets(
      referencedAssets(previous as LeanDoc).filter((a) => !kept.has(a.publicId)),
    );

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
  const unauthorized = await requirePermission("products:delete");
  if (unauthorized) return unauthorized;

  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();

    await connectToDatabase();
    const doc = await Product.findByIdAndDelete(id).lean();
    if (!doc) return badId();

    await deleteTypedAssets(referencedAssets(doc as LeanDoc));
    revalidateProduct((doc as LeanDoc).slug);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
