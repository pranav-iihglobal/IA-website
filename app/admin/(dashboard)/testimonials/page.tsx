import Link from "next/link";
import { TestimonialList } from "@/components/admin/TestimonialList";

export const dynamic = "force-dynamic";

export default function AdminTestimonialsPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-russet">
            Testimonials
          </h1>
          <p className="mt-1 text-olive-dark">
            Farmer stories shown on /testimonials.
          </p>
        </div>
        <Link
          href="/admin/testimonials/new"
          className="rounded-full bg-alloy px-5 py-2.5 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
        >
          + New testimonial
        </Link>
      </div>
      <div className="mt-8">
        <TestimonialList />
      </div>
    </>
  );
}
