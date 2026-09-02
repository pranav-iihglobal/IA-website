import { ProseSkeleton } from "@/components/Skeletons";

/*
  The Gujarati twin of the English loading state.

  The /gu/ tree had none at all, so every Gujarati page fell back to the
  layout's — a blank frame — while its English twin showed the shape of what
  was coming. Same skeleton, because it is the same page.
*/
export default function Loading() {
  return (
    <article className="container-page py-14">
      <div className="container-prose">
        <div className="skeleton h-4 w-28 rounded" aria-hidden="true" />
        <div className="skeleton mt-4 h-12 w-full rounded" aria-hidden="true" />
        <div className="skeleton mt-3 h-4 w-40 rounded" aria-hidden="true" />
        <div className="skeleton mt-8 aspect-[16/9] w-full rounded-2xl" aria-hidden="true" />
        <div className="mt-10">
          <ProseSkeleton paragraphs={5} />
        </div>
      </div>
    </article>
  );
}
