import { NextResponse, type NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase, isDatabaseConfigured } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Post } from "@/lib/db/models/Post";
import { errorResponse, requirePermission } from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Is this slug free?
 *
 * Lets the admin form warn while typing instead of failing with a 409 after
 * the whole thing is filled in. Advisory only — the unique index on the
 * collection is what actually enforces it.
 */
export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("products:read");
  if (unauthorized) return unauthorized;

  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type");
    const slug = (searchParams.get("slug") ?? "").trim().toLowerCase();
    const excludeId = searchParams.get("excludeId") ?? "";

    if (!slug || (type !== "product" && type !== "post")) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }
    if (!isDatabaseConfigured()) {
      // Nothing to collide with; let the form stay quiet.
      return NextResponse.json({ available: true });
    }

    await connectToDatabase();
    // Branch rather than picking the model into a variable: a union of two
    // Mongoose models has no callable common signature.
    const exclusion =
      excludeId && isValidObjectId(excludeId)
        ? { _id: { $ne: excludeId } }
        : {};
    const filter = { slug, ...exclusion };
    const existing =
      type === "product"
        ? await Product.findOne(filter).select("_id").lean()
        : await Post.findOne(filter).select("_id").lean();

    return NextResponse.json({ available: !existing });
  } catch (error) {
    return errorResponse(error);
  }
}
