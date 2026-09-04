import { PageHeaderSkeleton } from "@/components/admin/ui";
import { CardsSkeleton } from "@/components/admin/DashboardCards";

/**
 * Dashboard placeholder, in the page's own shape: header, then the cards
 * in their grid, so nothing jumps when they land.
 */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-6 min-w-0" aria-hidden="true">
        <CardsSkeleton />
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
