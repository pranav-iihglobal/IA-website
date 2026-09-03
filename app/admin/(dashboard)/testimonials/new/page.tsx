import {
  TestimonialForm,
} from "@/components/admin/TestimonialForm";
import { EMPTY_TESTIMONIAL } from "@/lib/admin/form-defaults";
import { getProductOptions } from "@/lib/admin/products-options";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "New testimonial" };
export const dynamic = "force-dynamic";

export default async function NewTestimonialPage() {
  await requirePageAccess("testimonials:write");

  const products = await getProductOptions();
  return (
    <>
      <FormPageHeader
        backHref="/admin/testimonials"
        backLabel="Testimonials"
        title={<>New testimonial</>}
      />
      <div className="mt-8">
        <TestimonialForm initial={EMPTY_TESTIMONIAL} products={products} />
      </div>
    </>
  );
}
