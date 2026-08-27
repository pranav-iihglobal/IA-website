import { EMPTY_POST, PostForm } from "@/components/admin/PostForm";
import { getTestimonialOptions } from "@/lib/admin/products-options";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  await requirePageAccess("posts:write");

  const testimonials = await getTestimonialOptions();

  return (
    <>
      <FormPageHeader
        backHref="/admin/blog"
        backLabel="Blog"
        title={<>New post</>}
      />
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
