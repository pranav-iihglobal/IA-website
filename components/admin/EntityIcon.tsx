import { entityIconPath } from "@/lib/admin/entity-icons";

/** The record kind's icon — the same shape the sidebar uses. Decorative. */
export function EntityIcon({ entity, className = "h-4 w-4" }: { entity: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={entityIconPath(entity)} />
    </svg>
  );
}
