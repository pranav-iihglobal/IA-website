import { PageHeaderSkeleton } from "@/components/admin/ui";

/** A short form, not a wizard — a header and one card. */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="admin-card mt-8 max-w-2xl space-y-3 p-6" aria-hidden="true">
        <div className="admin-skeleton h-4 w-40 rounded" />
        <div className="admin-skeleton h-11 w-full rounded-xl" />
        <div className="admin-skeleton h-11 w-full rounded-xl" />
      </div>
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
