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
import { getTestimonialOptions } from "@/lib/admin/products-options";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { istDateTimeInputValue } from "@/lib/time";

export const dynamic = "force-dynamic";

/**
 * datetime-local needs "YYYY-MM-DDTHH:mm", and it has no timezone.
 *
 * This page is a server component, so the old `getHours()` gave UTC: a post
 * scheduled for 09:00 IST was shown as 03:30, and one typed as 09:00 published
 * at 14:30 IST. `parseIstDateTimeInput` in lib/schemas.ts is the other half of
 * this — the two must agree.
 */
function toLocalInput(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return null;
  return istDateTimeInputValue(date);
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
    pinnedTestimonials: (doc.pinnedTestimonials ?? []).map(String),
    metaTitle: bi(doc.metaTitle),
    metaDescription: bi(doc.metaDescription),
  };
}

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("posts:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, testimonials] = await Promise.all([
    Post.findById(id).lean(),
    getTestimonialOptions(),
  ]);
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref="/admin/blog"
        backLabel="Blog"
        title={<>Edit {(doc as LeanDoc).title?.en}</>}
      />
      <div className="mt-8">
        <PostForm
          initial={toFormValues(doc)}
          postId={id}
          testimonials={testimonials.map((t) => ({
            id: t.id,
            label: t.name,
            hint: t.hint,
          }))}
        />
      </div>
    </>
  );
}
