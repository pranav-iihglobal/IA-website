import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Post } from "@/lib/db/models/Post";
import { postSchema } from "@/lib/schemas";
import { sanitizeHtml } from "@/lib/sanitize";
import type { LeanDoc } from "@/lib/db/lean";
import {
  currentEditor,
  errorResponse,
  fieldErrors,
  requirePermission,
  revalidatePost,
} from "@/lib/admin/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const unauthorized = await requirePermission("posts:read");
  if (unauthorized) return unauthorized;

  try {
    await connectToDatabase();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const search = (searchParams.get("search") ?? "").trim();
    const status = searchParams.get("status") ?? "";

    const filter: LeanDoc = {};
    if (["draft", "published", "scheduled"].includes(status)) filter.status = status;
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ "title.en": rx }, { "title.gu": rx }, { slug: rx }];
    }

    const [items, total] = await Promise.all([
      Post.find(filter)
        .select("title slug status category tags publishAt coverImage readingTime updatedAt")
        .sort({ publishAt: -1, updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Post.countDocuments(filter),
    ]);

    return NextResponse.json({
      items: items.map((p: LeanDoc) => ({
        id: String(p._id),
        title: p.title,
        slug: p.slug,
        status: p.status,
        category: p.category,
        tags: p.tags ?? [],
        publishAt: p.publishAt,
        cover: p.coverImage?.url ?? null,
        readingTime: p.readingTime,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * "Published" is a separate power from "can write a post".
 *
 * An editor drafts; making something visible to the public is an admin's
 * call. Enforced on the STATUS being written, not on the route, because the
 * same PATCH both saves a draft and publishes it depending on one field.
 *
 * Scheduled counts as publishing — it is publishing with a timer.
 */
async function refusePublish(status: string): Promise<NextResponse | null> {
  if (status !== "published" && status !== "scheduled") return null;
  return requirePermission("posts:publish");
}

export async function POST(request: NextRequest) {
  const unauthorized = await requirePermission("posts:write");
  if (unauthorized) return unauthorized;

  try {
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

    const denied = await refusePublish(parsed.data.status);
    if (denied) return denied;

    const data = {
      ...parsed.data,
      content: {
        en: sanitizeHtml(parsed.data.content.en),
        gu: sanitizeHtml(parsed.data.content.gu),
      },
    };

    await connectToDatabase();
    // create() (not insertMany/updateOne) so the pre-save hook computes
    // readingTime.
    const created = await Post.create({
      ...data,
      updatedBy: await currentEditor(),
    });
    revalidatePost(created.slug);

    return NextResponse.json({ id: String(created._id) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
