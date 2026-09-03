import Link from "next/link";
import { ProductList } from "@/components/admin/ProductList";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

/** The only filter the list has, accepted from the URL so the dashboard's drafts line can link here. */
const STATUS_PARAM = new Set(["draft", "published", "scheduled"]);

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const url = await searchParams;
  const status = typeof url.status === "string" && STATUS_PARAM.has(url.status) ? url.status : "";
  const me = await requirePageAccess("products:read");

  return (
    <>
      {/*
        The action sits beside the title on a phone rather than wrapping to
        its own row. That row plus a 3xl heading cost ~370px before a single
        product was visible — nearly half the screen spent on a page title.
      */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-ink-strong sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Everything shown on /products and the home page highlight.
          </p>
        </div>
        {/* A courtesy: the page and its API refuse the write anyway. */}
        {can(me, "products:write") && (
          <Link
            href="/admin/products/new"
            className="admin-btn admin-btn-primary shrink-0"
            aria-label="New product"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
            </svg>
            {/* "New product" does not fit beside a title at 390px. */}
            <span className="hidden sm:inline">New product</span>
            <span className="sm:hidden">New</span>
          </Link>
        )}
      </header>
      <div className="mt-8">
        <ProductList initialStatus={status} />
      </div>
    </>
  );
}
