import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Post } from "@/lib/db/models/Post";
import { postSchema } from "@/lib/schemas";
import { sanitizeHtml } from "@/lib/sanitize";
import { deleteAssets } from "@/lib/cloudinary";
import type { LeanDoc } from "@/lib/db/lean";
import {
  errorResponse,
  fieldErrors,
  requireAdmin,
  revalidatePost,
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
    const doc = await Post.findById(id).lean();
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

    const parsed = postSchema.safeParse(await request.json());
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
    const existing = await Post.findById(id);
    if (!existing) return badId();

    const previousSlug = existing.slug;
    const previousCover = existing.get("coverImage")?.publicId as string | undefined;

    existing.set({
      ...parsed.data,
      content: {
        en: sanitizeHtml(parsed.data.content.en),
        gu: sanitizeHtml(parsed.data.content.gu),
      },
    });
    // save() rather than findByIdAndUpdate so readingTime is recomputed.
    await existing.save();

    if (previousCover && previousCover !== parsed.data.coverImage.publicId) {
      await deleteAssets([previousCover]);
    }

    revalidatePost(existing.slug);
    if (previousSlug && previousSlug !== existing.slug) revalidatePost(previousSlug);

    return NextResponse.json({ id: String(existing._id) });
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
    const doc = await Post.findByIdAndDelete(id).lean();
    if (!doc) return badId();

    const coverId = (doc as LeanDoc).coverImage?.publicId;
    if (coverId) await deleteAssets([coverId]);

    revalidatePost((doc as LeanDoc).slug);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
