import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Testimonial } from "@/lib/db/models/Testimonial";
import { parseVideoEmbedId, testimonialSchema } from "@/lib/schemas";
import { deleteAssets } from "@/lib/cloudinary";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requireAdmin,
  revalidateTestimonials,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function badId() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(_request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    if (!isValidObjectId(id)) return badId();
    await connectToDatabase();
    const doc = await Testimonial.findById(id).lean();
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

    const parsed = testimonialSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Please fix the highlighted fields",
          fields: fieldErrors(parsed.error.issues),
        },
        { status: 400 },
      );
    }

    const data = { ...parsed.data };
    if (data.video.url && data.video.platform) {
      data.video.embedId =
        parseVideoEmbedId(data.video.platform, data.video.url) ?? "";
    }

    await connectToDatabase();
    const previous = await Testimonial.findById(id).select("photo").lean();
    if (!previous) return badId();

    const updated = await Testimonial.findByIdAndUpdate(
      id,
      { ...data, updatedBy: await currentEditor() },
      { new: true, runValidators: true },
    );
    if (!updated) return badId();

    // Drop the old photo from Cloudinary when it was replaced or removed.
    const oldPublicId = (previous as LeanDoc).photo?.publicId;
    if (oldPublicId && oldPublicId !== data.photo.publicId) {
      await deleteAssets([oldPublicId]);
    }

    revalidateTestimonials();
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
    const doc = await Testimonial.findByIdAndDelete(id).lean();
    if (!doc) return badId();

    const publicId = (doc as LeanDoc).photo?.publicId;
    if (publicId) await deleteAssets([publicId]);

    revalidateTestimonials();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
