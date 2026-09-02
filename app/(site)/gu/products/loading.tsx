import { CardGridSkeleton, PageHeadingSkeleton } from "@/components/Skeletons";

/*
  The Gujarati twin of the English loading state.

  The /gu/ tree had none at all, so every Gujarati page fell back to the
  layout's — a blank frame — while its English twin showed the shape of what
  was coming. Same skeleton, because it is the same page.
*/
export default function Loading() {
  return (
    <section className="container-page py-14">
      <PageHeadingSkeleton />
      <div className="mt-10">
        <CardGridSkeleton count={3} />
      </div>
    </section>
  );
}
