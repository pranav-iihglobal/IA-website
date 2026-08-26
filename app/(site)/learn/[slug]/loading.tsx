import { ProseSkeleton } from "@/components/Skeletons";

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
