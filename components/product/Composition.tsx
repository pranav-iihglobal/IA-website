import { T } from "@/components/T";
import { UI } from "@/lib/content";
import type { PublicComposition, PublicRegulatory } from "@/lib/db/queries";

/**
 * What is in the pack, and under what licence it is sold.
 *
 * Both were editable in the admin from the start and neither had anywhere to
 * appear. Composition is what a careful farmer reads before buying, and the
 * FCO details are what a dealer or an inspector asks for — printing them here
 * matches what is on the physical label.
 *
 * The whole block disappears when there is nothing to show, rather than
 * rendering an empty heading over a blank table.
 */
export function Composition({
  rows,
  regulatory,
}: {
  rows: PublicComposition[];
  regulatory: PublicRegulatory;
}) {
  const hasRegulatory =
    regulatory.fcoCompliant ||
    Boolean(regulatory.fcoSchedule) ||
    Boolean(regulatory.licenseNo);

  if (rows.length === 0 && !hasRegulatory) return null;

  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={UI.compositionHeading} />
      </h2>

      {rows.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-camel-light">
          {/* Wide content scrolls inside its own box rather than the page. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-sm">
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-camel-light/40 bg-cornsilk-light last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="px-5 py-3 font-semibold text-russet"
                    >
                      {row.ingredient}
                    </th>
                    <td className="px-5 py-3 text-right text-olive-dark">
                      {row.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasRegulatory && (
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          {regulatory.fcoCompliant && (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-laurel-light text-olive-dark"
              >
                ✓
              </span>
              <dt className="sr-only">
                <T text={UI.fcoLabel} />
              </dt>
              <dd className="font-semibold text-olive-dark">
                <T text={UI.fcoCompliant} />
                {regulatory.fcoSchedule && ` · ${regulatory.fcoSchedule}`}
              </dd>
            </div>
          )}
          {regulatory.licenseNo && (
            <div className="flex gap-2">
              <dt className="text-russet-dark/60">
                <T text={UI.licenceNo} />
              </dt>
              <dd className="font-semibold text-russet">
                {regulatory.licenseNo}
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
