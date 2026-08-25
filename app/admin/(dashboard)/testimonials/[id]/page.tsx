import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Testimonial } from "@/lib/db/models/Testimonial";
import type { LeanDoc } from "@/lib/db/lean";
import {
  EMPTY_TESTIMONIAL,
  TestimonialForm,
  type TestimonialFormValues,
} from "@/components/admin/TestimonialForm";
import { getProductOptions } from "@/lib/admin/products-options";

export const dynamic = "force-dynamic";

function toFormValues(doc: LeanDoc): TestimonialFormValues {
  const bi = (v: LeanDoc | undefined) => ({ en: v?.en ?? "", gu: v?.gu ?? "" });
  return {
    ...EMPTY_TESTIMONIAL,
    farmerName: bi(doc.farmerName),
    village: doc.village ?? "",
    taluka: doc.taluka ?? "",
    district: doc.district ?? "",
    crop: bi(doc.crop),
    quote: bi(doc.quote),
    photo: {
      url: doc.photo?.url ?? "",
      publicId: doc.photo?.publicId ?? "",
    },
    video: {
      platform: doc.video?.platform ?? "",
      url: doc.video?.url ?? "",
      embedId: doc.video?.embedId ?? "",
    },
    productUsed: doc.productUsed ? String(doc.productUsed) : null,
    rating: doc.rating ?? "",
    status: doc.status ?? "draft",
    featured: Boolean(doc.featured),
    displayOrder: doc.displayOrder ?? 0,
  };
}

export default async function EditTestimonialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = await Testimonial.findById(id).lean();
  if (!doc) notFound();

  const products = await getProductOptions();

  return (
    <>
      <nav className="mb-5">
        <Link
          href="/admin/testimonials"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-olive-dark transition-colors hover:bg-meringue hover:text-russet"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
          </svg>
          Testimonials
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">
        Edit {(doc as LeanDoc).farmerName?.en}
      </h1>
      <div className="mt-8">
        <TestimonialForm
          initial={toFormValues(doc)}
          testimonialId={id}
          products={products}
        />
      </div>
    </>
  );
}
