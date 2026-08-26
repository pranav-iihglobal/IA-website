/**
 * Public-site loading placeholders.
 *
 * Each one mirrors the real page's grid and card proportions, so the layout
 * settles instead of jumping when the content arrives. They are decorative —
 * `aria-hidden` on the shapes, with a single polite status line for screen
 * readers, which announce "Loading" once rather than reading out a wall of
 * empty boxes.
 */

function Bar({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} />;
}

function LoadingAnnounce() {
  return (
    <span className="sr-only" role="status">
      Loading…
    </span>
  );
}

/** Product / testimonial card grid. */
export function CardGridSkeleton({
  count = 3,
  media = true,
}: {
  count?: number;
  media?: boolean;
}) {
  return (
    <>
      <div
        className="grid gap-6 grid-cols-[repeat(auto-fit,minmax(280px,1fr))]"
        aria-hidden="true"
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk-light"
          >
            {media && <div className="skeleton h-64 w-full lg:h-72" />}
            <div className="space-y-3 p-6">
              <Bar className="h-3 w-24" />
              <Bar className="h-7 w-3/4" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-5/6" />
              <Bar className="mt-2 h-4 w-28" />
            </div>
          </div>
        ))}
      </div>
      <LoadingAnnounce />
    </>
  );
}

/** Stacked article cards on /learn. */
export function ArticleListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      <div className="space-y-6" aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-cornsilk-dark bg-cornsilk"
          >
            <div className="skeleton h-56 w-full" />
            <div className="space-y-3 p-6">
              <Bar className="h-7 w-4/5" />
              <Bar className="h-3 w-24" />
              <Bar className="h-4 w-full" />
              <Bar className="h-4 w-2/3" />
              <Bar className="mt-2 h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
      <LoadingAnnounce />
    </>
  );
}

/** Heading block above a listing. */
export function PageHeadingSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Bar className={wide ? "h-11 w-96 max-w-full" : "h-11 w-72 max-w-full"} />
      <Bar className="h-4 w-full max-w-xl" />
    </div>
  );
}

/** Long-form article body. */
export function ProseSkeleton({ paragraphs = 5 }: { paragraphs?: number }) {
  return (
    <>
      <div className="space-y-6" aria-hidden="true">
        {Array.from({ length: paragraphs }).map((_, i) => (
          <div key={i} className="space-y-2.5">
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-full" />
            <Bar className="h-4 w-4/5" />
          </div>
        ))}
      </div>
      <LoadingAnnounce />
    </>
  );
}
