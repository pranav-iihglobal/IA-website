import { ListPageSkeleton } from "@/components/admin/ui";

/**
 * Shown while this route streams in.
 *
 * Without one, the segment inherited the DASHBOARD's loading.tsx and every
 * list flashed three stat cards on the way in. The page's own skeleton sits
 * inside a Suspense that is only reached after the slow await, so it never
 * covered this moment.
 */
export default function Loading() {
  return <ListPageSkeleton rows={5} />;
}
