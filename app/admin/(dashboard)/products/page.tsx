import Link from "next/link";
import { ProductList } from "@/components/admin/ProductList";

export const dynamic = "force-dynamic";

export default function AdminProductsPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-russet">Products</h1>
          <p className="mt-1 text-olive-dark">
            Everything shown on /products and the home page highlight.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-full bg-alloy px-5 py-2.5 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
        >
          + New product
        </Link>
      </div>
      <div className="mt-8">
        <ProductList />
      </div>
    </>
  );
}
