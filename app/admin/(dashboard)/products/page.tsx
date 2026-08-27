import Link from "next/link";
import { ProductList } from "@/components/admin/ProductList";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const me = await requirePageAccess("products:read");

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-russet">Products</h1>
          <p className="mt-1 text-sm text-olive-dark">
            Everything shown on /products and the home page highlight.
          </p>
        </div>
        {/* A courtesy: the page and its API refuse the write anyway. */}
        {can(me, "products:write") && (
          <Link href="/admin/products/new" className="admin-btn admin-btn-primary">
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
              </svg>
            New product
          </Link>
        )}
      </header>
      <div className="mt-8">
        <ProductList />
      </div>
    </>
  );
}
