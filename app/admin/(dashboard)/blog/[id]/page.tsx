import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Post } from "@/lib/db/models/Post";
import type { LeanDoc } from "@/lib/db/lean";
import {
  EMPTY_POST,
  PostForm,
  type PostFormValues,
} from "@/components/admin/PostForm";

export const dynamic = "force-dynamic";

/** datetime-local needs "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toFormValues(doc: LeanDoc): PostFormValues {
  const bi = (v: LeanDoc | undefined) => ({ en: v?.en ?? "", gu: v?.gu ?? "" });
  return {
    ...EMPTY_POST,
    title: bi(doc.title),
    slug: doc.slug ?? "",
    excerpt: bi(doc.excerpt),
    content: bi(doc.content),
    coverImage: {
      url: doc.coverImage?.url ?? "",
      publicId: doc.coverImage?.publicId ?? "",
      alt: bi(doc.coverImage?.alt),
    },
    tags: doc.tags ?? [],
    category: doc.category ?? "other",
    status: doc.status ?? "draft",
    publishAt: toLocalInput(doc.publishAt),
    author: doc.author ?? "IKSARVA Team",
    metaTitle: bi(doc.metaTitle),
    metaDescription: bi(doc.metaDescription),
  };
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = await Post.findById(id).lean();
  if (!doc) notFound();

  return (
    <>
      <nav className="mb-5">
        <Link
          href="/admin/blog"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-olive-dark transition-colors hover:bg-meringue hover:text-russet"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
          </svg>
          Blog
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">
        Edit {(doc as LeanDoc).title?.en}
      </h1>
      <div className="mt-8">
        <PostForm initial={toFormValues(doc)} postId={id} />
      </div>
    </>
  );
}
