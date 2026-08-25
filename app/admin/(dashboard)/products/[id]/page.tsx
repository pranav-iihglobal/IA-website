import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import type { LeanDoc } from "@/lib/db/lean";
import {
  EMPTY_PRODUCT,
  ProductForm,
  type ProductFormValues,
} from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

/** Merge a stored document onto the empty shape so new fields never crash. */
function toFormValues(doc: LeanDoc): ProductFormValues {
  const bi = (v: LeanDoc | undefined) => ({ en: v?.en ?? "", gu: v?.gu ?? "" });
  return {
    ...EMPTY_PRODUCT,
    name: bi(doc.name),
    slug: doc.slug ?? "",
    category: doc.category ?? "other",
    categoryLabel: bi(doc.categoryLabel),
    tagline: bi(doc.tagline),
    description: bi(doc.description),
    benefits: (doc.benefits ?? []).map(bi),
    format: bi(doc.format),
    complianceNote: bi(doc.complianceNote),
    whatsappMessage: doc.whatsappMessage ?? "",
    dosage: {
      amountPerAcre: doc.dosage?.amountPerAcre ?? "",
      unit: doc.dosage?.unit ?? "g",
      summary: bi(doc.dosage?.summary),
      applicationMethod: bi(doc.dosage?.applicationMethod),
      cropStage: bi(doc.dosage?.cropStage),
    },
    suitableCrops: doc.suitableCrops ?? [],
    cropsNote: bi(doc.cropsNote),
    sku: doc.sku ?? "",
    hsnCode: doc.hsnCode ?? "",
    gstRatePercent: doc.gstRatePercent ?? 0,
    composition: (doc.composition ?? []).map((c: LeanDoc) => ({
      ingredient: c.ingredient ?? "",
      quantity: c.quantity ?? "",
    })),
    packSizes: (doc.packSizes ?? []).map((p: LeanDoc) => ({
      label: p.label ?? "",
      netQuantity: p.netQuantity ?? "",
      unit: p.unit ?? "g",
      mrp: p.mrp ?? "",
      dealerPrice: p.dealerPrice ?? "",
    })),
    regulatory: {
      fcoCompliant: Boolean(doc.regulatory?.fcoCompliant),
      fcoSchedule: doc.regulatory?.fcoSchedule ?? "",
      licenseNo: doc.regulatory?.licenseNo ?? "",
    },
    images: (doc.images ?? []).map((i: LeanDoc) => ({
      url: i.url,
      publicId: i.publicId ?? "",
      alt: bi(i.alt),
      isPrimary: Boolean(i.isPrimary),
    })),
    artFallback: doc.artFallback ?? "sachet",
    status: doc.status ?? "draft",
    featured: Boolean(doc.featured),
    displayOrder: doc.displayOrder ?? 0,
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = await Product.findById(id).lean();
  if (!doc) notFound();

  return (
    <>
      <nav className="mb-5">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold text-olive-dark transition-colors hover:bg-meringue hover:text-russet"
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M12.7 4.3a1 1 0 0 1 0 1.4L8.4 10l4.3 4.3a1 1 0 0 1-1.4 1.4l-5-5a1 1 0 0 1 0-1.4l5-5a1 1 0 0 1 1.4 0Z" />
          </svg>
          Products
        </Link>
      </nav>
      <h1 className="font-display text-3xl font-bold text-russet">
        Edit {(doc as LeanDoc).name?.en}
      </h1>
      <div className="mt-8">
        <ProductForm initial={toFormValues(doc)} productId={id} />
      </div>
    </>
  );
}
