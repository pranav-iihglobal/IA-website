import { PageHeaderSkeleton } from "@/components/admin/ui";

/**
 * Dashboard placeholder. The three stat cards are the whole page, so the
 * skeleton mirrors their grid exactly — otherwise the layout jumps when the
 * counts arrive.
 */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div
        className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="admin-card p-6">
            <div className="admin-skeleton h-11 w-11 rounded-xl" />
            <div className="admin-skeleton mt-5 h-3 w-20 rounded" />
            <div className="admin-skeleton mt-2 h-9 w-16 rounded" />
            <div className="admin-skeleton mt-2 h-3.5 w-28 rounded" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
