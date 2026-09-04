import { ListPageSkeleton } from "@/components/admin/ui";

/** Shown while this route streams in — see stock/loading.tsx. */
export default function Loading() {
  return <ListPageSkeleton rows={4} />;
}
