import { ArticleListSkeleton, PageHeadingSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <section className="container-page py-14">
      <PageHeadingSkeleton />
      <div className="mt-10">
        <ArticleListSkeleton count={3} />
      </div>
    </section>
  );
}
