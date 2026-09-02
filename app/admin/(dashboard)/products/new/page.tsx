import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/ProductForm";
import {
  getProductOptions,
  getTestimonialOptions,
} from "@/lib/admin/products-options";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "New product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requirePageAccess("products:write");

  const [products, testimonials] = await Promise.all([
    getProductOptions(),
    getTestimonialOptions(),
  ]);

  return (
    <>
      <FormPageHeader
        backHref="/admin/products"
        backLabel="Products"
        title={<>New product</>}
        description={<>Saved as a draft unless you set the status to published.</>}
      />
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
