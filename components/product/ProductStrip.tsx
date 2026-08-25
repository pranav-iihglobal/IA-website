import type { Bi } from "@/lib/content";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { T } from "@/components/T";

/**
 * A titled row of product cards — used for "Use together" (with a pairing
 * note under each card) and for related products at the bottom of the page.
 *
 * Reuses the real ProductCard so these rows can never drift from the cards on
 * /products.
 */

export interface StripItem {
  product: ProductCardData;
  /** Optional pairing note, e.g. "Mycho at sowing + FloraMax at flowering". */
  note?: Bi;
}

export function ProductStrip({
  heading,
  note,
  items,
}: {
  heading: Bi;
  note?: Bi;
  items: StripItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={heading} />
      </h2>
      {note && (
        <p className="mt-1 text-sm text-olive-dark">
          <T text={note} />
        </p>
      )}

      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.product.slug} className="flex flex-col">
            <ProductCard product={item.product} />
            {item.note?.en && (
              <p className="mt-3 rounded-xl bg-meringue-light px-4 py-3 text-sm leading-relaxed text-russet-dark">
                <T text={item.note} />
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
