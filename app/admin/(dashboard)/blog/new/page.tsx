import Link from "next/link";
import { EMPTY_POST, PostForm } from "@/components/admin/PostForm";
import { getTestimonialOptions } from "@/lib/admin/products-options";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const testimonials = await getTestimonialOptions();

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
      <h1 className="font-display text-3xl font-bold text-russet">New post</h1>
      <div className="mt-8">
        <PostForm
          initial={EMPTY_POST}
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
