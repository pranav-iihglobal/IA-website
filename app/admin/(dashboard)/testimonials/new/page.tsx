import Link from "next/link";
import {
  EMPTY_TESTIMONIAL,
  TestimonialForm,
} from "@/components/admin/TestimonialForm";
import { getProductOptions } from "@/lib/admin/products-options";

export const dynamic = "force-dynamic";

export default async function NewTestimonialPage() {
  const products = await getProductOptions();
  return (
    <>
      <nav className="mb-4 text-sm">
        <Link href="/admin/testimonials" className="text-alloy-dark hover:underline">
          ← Testimonials
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">
        New testimonial
      </h1>
      <div className="mt-8">
        <TestimonialForm initial={EMPTY_TESTIMONIAL} products={products} />
      </div>
    </>
  );
}
