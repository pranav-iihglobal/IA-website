import { PageHeaderSkeleton } from "@/components/admin/ui";

/** Header, the money row, then two columns — the shape of the detail page. */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="admin-card mt-6 grid grid-cols-2 gap-4 p-4 sm:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="admin-skeleton h-3 w-16 rounded" />
            <div className="admin-skeleton mt-2 h-6 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" aria-hidden="true">
        <div className="admin-card h-72 p-4" />
        <div className="admin-card h-56 p-4" />
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
