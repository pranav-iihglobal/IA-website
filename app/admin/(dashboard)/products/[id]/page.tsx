import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import type { LeanDoc } from "@/lib/db/lean";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { EMPTY_PRODUCT } from "@/lib/admin/form-defaults";
import {
  getProductOptions,
  getTestimonialOptions,
} from "@/lib/admin/products-options";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { paiseToRupeeString } from "@/lib/money";

export const metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

/**
 * A stored price, as the form should show it.
 *
 * Blank for an unset price rather than "0". They are different facts — one
 * means nobody has decided, the other means free — and collapsing them here
 * would write a zero price back on the next save.
 */
function rupeesOrBlank(paise: unknown): string {
  return typeof paise === "number" ? paiseToRupeeString(paise) : "";
}

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
    // Stored as basis points, edited as a percentage. See lib/schemas.ts.
    gstRatePercent: (doc.gstRateBps ?? 0) / 100,
    composition: (doc.composition ?? []).map((c: LeanDoc) => ({
      ingredient: c.ingredient ?? "",
      quantity: c.quantity ?? "",
    })),
    /*
      Paise back out to rupees, because that is what people type. Blank stays
      blank rather than becoming "0" — an unpriced pack must not look free,
      and saving would then write a zero price that nobody chose.
    */
    packSizes: (doc.packSizes ?? []).map((p: LeanDoc) => ({
      label: p.label ?? "",
      netQuantity: p.netQuantity ?? "",
      unit: p.unit ?? "g",
      mrp: rupeesOrBlank(p.mrpPaise),
      farmerPrice: rupeesOrBlank(p.farmerPricePaise),
      unitsPerBox: p.unitsPerBox ? String(p.unitsPerBox) : "",
      dealerPrice: rupeesOrBlank(p.dealerPricePaise),
      cost: rupeesOrBlank(p.costPaise),
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
    // Fields added after these documents were written read back undefined.
    assets: (doc.assets ?? []).map((a: LeanDoc) => ({
      type: a.type ?? "other",
      title: bi(a.title),
      fileUrl: a.fileUrl ?? "",
      publicId: a.publicId ?? "",
      resourceType: a.resourceType ?? "raw",
      sizeBytes: a.sizeBytes ?? 0,
    })),
    applicationSteps: (doc.applicationSteps ?? []).map(
      (s: LeanDoc, i: number) => ({
        image: { url: s.image?.url ?? "", publicId: s.image?.publicId ?? "" },
        caption: bi(s.caption),
        order: s.order ?? i,
      }),
    ),
    fieldResults: (doc.fieldResults ?? []).map((r: LeanDoc) => ({
      beforeImage: {
        url: r.beforeImage?.url ?? "",
        publicId: r.beforeImage?.publicId ?? "",
      },
      afterImage: {
        url: r.afterImage?.url ?? "",
        publicId: r.afterImage?.publicId ?? "",
      },
      crop: r.crop ?? "",
      district: r.district ?? "",
      description: bi(r.description),
      farmerName: r.farmerName ?? "",
    })),
    faqs: (doc.faqs ?? []).map((f: LeanDoc, i: number) => ({
      question: bi(f.question),
      answer: bi(f.answer),
      order: f.order ?? i,
    })),
    relatedProducts: (doc.relatedProducts ?? []).map(String),
    pairsWellWith: (doc.pairsWellWith ?? []).map((p: LeanDoc) => ({
      product: String(p.product ?? ""),
      note: bi(p.note),
    })),
    pinnedTestimonials: (doc.pinnedTestimonials ?? []).map(String),
    availability: doc.availability ?? "in_stock",
    availabilityNote: bi(doc.availabilityNote),
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
  await requirePageAccess("products:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, products, testimonials] = await Promise.all([
    Product.findById(id).lean(),
    getProductOptions(),
    getTestimonialOptions(),
  ]);
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref="/admin/products"
        backLabel="Products"
        title={<>Edit {(doc as LeanDoc).name?.en}</>}
      />
      <div className="mt-8">
        <ProductForm
          initial={toFormValues(doc)}
          productId={id}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
          testimonials={testimonials.map((t) => ({
            id: t.id,
            label: t.name,
            hint: t.hint,
          }))}
        />
      </div>
    </>
  );
}
