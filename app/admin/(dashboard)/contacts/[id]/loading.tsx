import { PageHeaderSkeleton } from "@/components/admin/ui";

/** A profile, not a list and not the dashboard's stat cards. */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-8 grid gap-5 lg:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="admin-card space-y-3 p-4">
            <div className="admin-skeleton h-4 w-32 rounded" />
            <div className="admin-skeleton h-3 w-full rounded" />
            <div className="admin-skeleton h-3 w-5/6 rounded" />
            <div className="admin-skeleton h-3 w-2/3 rounded" />
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
