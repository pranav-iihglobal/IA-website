import Link from "next/link";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default function NewProductPage() {
  return (
    <>
      <nav className="mb-4 text-sm">
        <Link href="/admin/products" className="text-alloy-dark hover:underline">
          ← Products
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">New product</h1>
      <p className="mt-1 text-olive-dark">
        Saved as a draft unless you set the status to published.
      </p>
      <div className="mt-8">
        <ProductForm initial={EMPTY_PRODUCT} />
      </div>
    </>
  );
}
