import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/ProductForm";
import {
  getProductOptions,
  getTestimonialOptions,
} from "@/lib/admin/products-options";
import { BackLink } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePageAccess("products:write");

  const [products, testimonials] = await Promise.all([
    getProductOptions(),
    getTestimonialOptions(),
  ]);

  return (
    <>
      <BackLink href="/admin/products" label="Products" />
      <h1 className="font-display text-3xl font-bold text-russet">New product</h1>
      <p className="mt-1 text-olive-dark">
        Saved as a draft unless you set the status to published.
      </p>
      <div className="mt-8">
        <ProductForm
          initial={EMPTY_PRODUCT}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
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
