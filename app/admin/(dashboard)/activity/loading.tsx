import { PageHeaderSkeleton, TableSkeleton } from "@/components/admin/ui";

/** The audit log is a list; the dashboard's stat cards are not it. */
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
