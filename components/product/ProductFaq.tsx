import type { Bi } from "@/lib/content";
import { UI } from "@/lib/content";
import { T } from "@/components/T";

/**
 * FAQ accordion.
 *
 * Built on native <details>/<summary>: keyboard and screen-reader behaviour
 * comes free, and it works before (or without) any JavaScript — which matters
 * on the rural connections this site is built for.
 */

export interface FaqItem {
  question: Bi;
  answer: Bi;
}

export function ProductFaq({ faqs }: { faqs: FaqItem[] }) {
  if (faqs.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={UI.faqHeading} />
      </h2>

      <div className="mt-4 divide-y divide-cornsilk-dark overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light">
        {faqs.map((faq, i) => (
          <details key={i} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold text-russet transition-colors hover:bg-meringue-light">
              <span>
                <T text={faq.question} />
              </span>
              <svg
                viewBox="0 0 20 20"
                className="h-5 w-5 shrink-0 text-alloy transition-transform duration-200 group-open:rotate-45"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
              </svg>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-russet-dark">
              <T text={faq.answer} />
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
