import { CardGridSkeleton, PageHeadingSkeleton } from "@/components/Skeletons";

/*
  The Gujarati twin of the English loading state.

  The /gu/ tree had none at all, so every Gujarati page fell back to the
  layout's — a blank frame — while its English twin showed the shape of what
  was coming. Same skeleton, because it is the same page.
*/
export default function Loading() {
  return (
    <div>
      <section className="bg-meringue-light py-14">
        <div className="container-page">
          <PageHeadingSkeleton wide />
        </div>
      </section>
      <section className="container-page py-12">
        <div className="skeleton h-24 w-full rounded-2xl" aria-hidden="true" />
        <div className="mt-10">
          <CardGridSkeleton count={3} media={false} />
        </div>
      </section>
    </div>
  );
}
