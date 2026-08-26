import { ProseSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <div className="container-page py-14">
      <div className="skeleton h-4 w-32 rounded" aria-hidden="true" />
      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <div className="skeleton aspect-square w-full rounded-2xl" aria-hidden="true" />
        <div className="space-y-4">
          <div className="skeleton h-3 w-28 rounded" aria-hidden="true" />
          <div className="skeleton h-12 w-4/5 rounded" aria-hidden="true" />
          <div className="skeleton h-5 w-full rounded" aria-hidden="true" />
          <div className="skeleton h-5 w-2/3 rounded" aria-hidden="true" />
          <div className="skeleton mt-4 h-12 w-52 rounded-full" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-14">
        <ProseSkeleton paragraphs={4} />
      </div>
    </div>
  );
}
