import {
  EMPTY_TESTIMONIAL,
  TestimonialForm,
} from "@/components/admin/TestimonialForm";
import { getProductOptions } from "@/lib/admin/products-options";
import { BackLink } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewTestimonialPage() {
  const products = await getProductOptions();
  return (
    <>
      <BackLink href="/admin/testimonials" label="Testimonials" />
      <h1 className="font-display text-3xl font-bold text-russet">
        New testimonial
      </h1>
      <div className="mt-8">
        <TestimonialForm initial={EMPTY_TESTIMONIAL} products={products} />
      </div>
    </>
  );
}
