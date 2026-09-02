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
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";

export const metadata = { title: "Edit testimonial" };
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
    // Added after these documents were written — read back as undefined.
    source: doc.source ?? "admin_entered",
    verified: Boolean(doc.verified),
    verifiedVia: doc.verifiedVia ?? "",
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
  await requirePageAccess("testimonials:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = await Testimonial.findById(id).lean();
  if (!doc) notFound();

  const products = await getProductOptions();

  return (
    <>
      <FormPageHeader
        backHref="/admin/testimonials"
        backLabel="Testimonials"
        title={<>Edit {(doc as LeanDoc).farmerName?.en}</>}
      />
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
