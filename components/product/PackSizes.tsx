import { T } from "@/components/T";
import { UI } from "@/lib/content";
import type { PublicPackSize } from "@/lib/db/queries";
import { formatRupees } from "@/lib/money";

/**
 * What you can buy, and what it costs.
 *
 * The admin has collected pack sizes and MRPs since the beginning and no
 * public page ever showed them — the field projection excluded the whole
 * subtree because what IKSARVA pays and charges lives on it. Those are
 * stripped in lib/db/queries.ts now, so the MRP can be shown without them.
 *
 * MRP is a maximum, not a price we set, so it is labelled as one. A pack with
 * no price simply omits the figure rather than showing a blank column — a
 * missing price should read as "ask us", not as free.
 */
export function PackSizes({ sizes }: { sizes: PublicPackSize[] }) {
  if (sizes.length === 0) return null;
  const anyPriced = sizes.some((s) => typeof s.mrpPaise === "number");

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={UI.packSizesHeading} />
      </h2>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sizes.map((size, i) => (
          <li
            key={i}
            className="rounded-2xl border border-camel-light bg-cornsilk-light px-5 py-4"
          >
            <p className="font-display text-lg font-bold text-russet">
              {size.label}
            </p>
            {typeof size.netQuantity === "number" && (
              <p className="mt-0.5 text-sm text-olive-dark">
                {size.netQuantity} {size.unit}
              </p>
            )}
            {typeof size.mrpPaise === "number" && (
              <p className="mt-2 text-sm font-semibold text-alloy-dark">
                {formatRupees(size.mrpPaise)}
              </p>
            )}
          </li>
        ))}
      </ul>

      {anyPriced && (
        <p className="mt-3 text-xs text-russet-dark/55">
          <T text={UI.mrpNote} />
        </p>
      )}
    </section>
  );
}
