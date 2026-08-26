import { CardGridSkeleton, PageHeadingSkeleton } from "@/components/Skeletons";

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
