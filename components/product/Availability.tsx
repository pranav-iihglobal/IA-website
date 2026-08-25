import type { Bi } from "@/lib/content";
import { UI } from "@/lib/content";
import { T } from "@/components/T";

/**
 * Stock state shown on the product page.
 *
 * `in_stock` stays silent — a badge saying "Available" on every product is
 * noise. Only the states a farmer needs to act on are surfaced.
 */

export type Availability = "in_stock" | "out_of_stock" | "seasonal";

const STYLES: Record<Availability, string> = {
  in_stock: "bg-laurel-light/70 text-olive-dark",
  out_of_stock: "bg-camel-light/60 text-russet",
  seasonal: "bg-alloy/15 text-alloy-dark",
};

const LABELS: Record<Availability, Bi> = {
  in_stock: UI.inStock,
  out_of_stock: UI.outOfStock,
  seasonal: UI.seasonal,
};

export function AvailabilityBadge({
  availability,
  note,
}: {
  availability: Availability;
  note: Bi;
}) {
  if (availability === "in_stock") return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STYLES[availability]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        <T text={LABELS[availability]} />
      </span>
      {note.en && (
        <span className="text-sm text-olive-dark">
          <T text={note} />
        </span>
      )}
    </div>
  );
}
