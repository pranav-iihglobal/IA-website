import { PageHeaderSkeleton } from "@/components/admin/ui";

/** Header, a row of figures, then the history. */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="admin-card mt-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="admin-skeleton h-3 w-20 rounded" />
            <div className="admin-skeleton mt-2 h-6 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="admin-card mt-5 h-52 p-4" aria-hidden="true" />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
