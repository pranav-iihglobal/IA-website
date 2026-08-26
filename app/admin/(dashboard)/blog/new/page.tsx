import { EMPTY_POST, PostForm } from "@/components/admin/PostForm";
import { getTestimonialOptions } from "@/lib/admin/products-options";
import { BackLink } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  const testimonials = await getTestimonialOptions();

  return (
    <>
      <BackLink href="/admin/blog" label="Blog" />
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
