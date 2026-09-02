import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/ui";

/** A header and the return's tables — not the dashboard's stat cards. */
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} />
      <span className="sr-only" role="status">
        Loading…
      </span>
    </>
  );
}
