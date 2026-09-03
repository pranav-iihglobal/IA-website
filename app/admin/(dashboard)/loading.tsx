import { PageHeaderSkeleton } from "@/components/admin/ui";
import { CardsSkeleton } from "@/components/admin/DashboardCards";

/**
 * Dashboard placeholder, in the page's own shape: header, then the Today
 * column and the cards in the same grid, so nothing jumps when they land.
 */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8" aria-hidden="true">
        <div className="order-first space-y-3 lg:order-none lg:col-start-2">
          <div className="admin-skeleton h-3 w-12 rounded" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="admin-card p-3">
              <div className="admin-skeleton h-4 w-32 rounded" />
              <div className="admin-skeleton mt-2 h-3 w-full rounded" />
              <div className="admin-skeleton mt-1.5 h-3 w-3/4 rounded" />
            </div>
          ))}
        </div>
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <CardsSkeleton />
        </div>
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
