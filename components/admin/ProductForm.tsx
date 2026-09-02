"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { slugify } from "@/lib/schemas";
import { rupeesToPaise } from "@/lib/money";
import { describeMargin } from "@/lib/erp/margin";
import { ProductCard } from "@/components/ProductCard";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import { FileUploader, type AdminAsset } from "./FileUploader";
import { SingleImageField, type MediaRef } from "./SingleImageField";
import { EntityPicker, EntitySelect, type PickerOption } from "./EntityPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { SlugField } from "./SlugField";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { useToast } from "./Toast";
import {
  BiField,
  ErrorBanner,
  FieldGroup,
  RepeatableList,
  Section,
  SelectField,
  TextareaField,
  TextField,
  Toggle,
} from "./ui";

const EMPTY_BI: Bi = { en: "", gu: "" };

export interface ProductFormValues {
  name: Bi;
  slug: string;
  category: string;
  categoryLabel: Bi;
  tagline: Bi;
  description: Bi;
  benefits: Bi[];
  format: Bi;
  complianceNote: Bi;
  whatsappMessage: string;
  dosage: {
    amountPerAcre?: number | string;
    unit: string;
    summary: Bi;
    applicationMethod: Bi;
    cropStage: Bi;
  };
  suitableCrops: string[];
  cropsNote: Bi;
  sku: string;
  hsnCode: string;
  gstRatePercent: number | string;
  composition: { ingredient: string; quantity: string }[];
  packSizes: {
    label: string;
    netQuantity?: number | string;
    unit: string;
    /* Typed in RUPEES. lib/schemas.ts converts to paise on save. */
    mrp?: number | string;
    farmerPrice?: number | string;
    dealerPrice?: number | string;
    cost?: number | string;
  }[];
  regulatory: { fcoCompliant: boolean; fcoSchedule: string; licenseNo: string };

  assets: AdminAsset[];
  applicationSteps: { image: MediaRef; caption: Bi; order: number }[];
  fieldResults: {
    beforeImage: MediaRef;
    afterImage: MediaRef;
    crop: string;
    district: string;
    description: Bi;
    farmerName: string;
  }[];
  faqs: { question: Bi; answer: Bi; order: number }[];
  relatedProducts: string[];
  pairsWellWith: { product: string; note: Bi }[];
  pinnedTestimonials: string[];
  availability: "in_stock" | "out_of_stock" | "seasonal";
  availabilityNote: Bi;

  images: AdminImage[];
  artFallback: "sachet" | "roots" | "network";
  status: "draft" | "published";
  featured: boolean;
  displayOrder: number | string;
}

export const EMPTY_PRODUCT: ProductFormValues = {
  name: { ...EMPTY_BI },
  slug: "",
  category: "other",
  categoryLabel: { ...EMPTY_BI },
  tagline: { ...EMPTY_BI },
  description: { ...EMPTY_BI },
  benefits: [],
  format: { ...EMPTY_BI },
  complianceNote: { ...EMPTY_BI },
  whatsappMessage: "",
  dosage: {
    amountPerAcre: "",
    unit: "g",
    summary: { ...EMPTY_BI },
    applicationMethod: { ...EMPTY_BI },
    cropStage: { ...EMPTY_BI },
  },
  suitableCrops: [],
  cropsNote: { ...EMPTY_BI },
  sku: "",
  hsnCode: "",
  gstRatePercent: 0,
  composition: [],
  packSizes: [],
  regulatory: { fcoCompliant: false, fcoSchedule: "", licenseNo: "" },

  assets: [],
  applicationSteps: [],
  fieldResults: [],
  faqs: [],
  relatedProducts: [],
  pairsWellWith: [],
  pinnedTestimonials: [],
  availability: "in_stock",
  availabilityNote: { ...EMPTY_BI },

  images: [],
  artFallback: "sachet",
  status: "draft",
  featured: false,
  displayOrder: 0,
};

/**
 * What each pack earns, live as the prices are typed.
 *
 * Derived on every render rather than stored: a margin saved onto the product
 * would be wrong the moment a cost changed, and nobody would notice.
 *
 * Both prices are shown because they are genuinely different businesses — a
 * dealer sale at a lower price can still be the better one on volume, and
 * that is a judgement only a director can make with both numbers in front of
 * them.
 */
function PackMargins({
  pack,
}: {
  pack: { farmerPrice?: number | string; dealerPrice?: number | string; cost?: number | string };
}) {
  const paise = (value: number | string | undefined) =>
    value === "" || value === undefined ? null : rupeesToPaise(value);

  const cost = paise(pack.cost);
  const farmer = describeMargin(paise(pack.farmerPrice), cost);
  const dealer = describeMargin(paise(pack.dealerPrice), cost);
  if (!farmer && !dealer) return null;

  return (
    <p className="col-span-full text-xs font-semibold text-ink-soft">
      Margin:{" "}
      {[farmer && `farmer ${farmer}`, dealer && `dealer ${dealer}`]
        .filter(Boolean)
        .join("  ·  ")}
    </p>
  );
}

export function ProductForm({
  initial,
  productId,
  products = [],
  testimonials = [],
}: {
  initial: ProductFormValues;
  productId?: string;
  /** All products, for the related / pairing pickers. */
  products?: PickerOption[];
  /** Published testimonials, for pinning. */
  testimonials?: PickerOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  // save() is defined before the draft hook; the ref bridges the two.
  const clearDraft = useRef<() => void>(() => {});

  function update<K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  }

  // Warn before losing unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Auto-slug from the English name until the admin edits the slug directly.
  useEffect(() => {
    if (slugTouched) return;
    setValues((v) => ({ ...v, slug: slugify(v.name.en) }));
  }, [values.name.en, slugTouched]);

  const previewImage = useMemo(() => {
    const primary = values.images.find((i) => i.isPrimary) ?? values.images[0];
    return primary?.url ?? null;
  }, [values.images]);

  // A product can't be related to, or paired with, itself.
  const otherProducts = useMemo(
    () => products.filter((p) => p.id !== productId),
    [products, productId],
  );

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = {
        ...values,
        gstRatePercent: Number(values.gstRatePercent) || 0,
        displayOrder: Number(values.displayOrder) || 0,
        dosage: {
          ...values.dosage,
          amountPerAcre:
            values.dosage.amountPerAcre === "" ||
            values.dosage.amountPerAcre === undefined
              ? undefined
              : Number(values.dosage.amountPerAcre),
        },
        /*
          Prices go over as typed. They are rupee strings, and the ONLY place
          they become paise is rupeeField() in lib/schemas.ts — converting
          here as well would be a second conversion to keep in step.
        */
        packSizes: values.packSizes.map((p) => ({
          ...p,
          netQuantity: p.netQuantity === "" ? undefined : Number(p.netQuantity),
        })),
      };

      const result = await adminFetch<{ id: string }>(
        productId ? `/api/admin/products/${productId}` : "/api/admin/products",
        {
          method: productId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!result.ok) {
        const message = result.error ?? "Could not save";
        setFormError(message);
        const fields = (result.data as { fields?: Record<string, string> } | null)?.fields;
        if (fields) setErrors(fields);
        toast(message, "error");
        setSaving(false);
        return;
      }

      setDirty(false);
      clearDraft.current();
      toast(
        productId
          ? `“${values.name.en}” saved`
          : `“${values.name.en}” created as ${values.status === "published" ? "published" : "a draft"}`,
      );
      router.push("/admin/products");
      router.refresh();
    } catch {
      setFormError("Network error — please try again");
      toast("Network error — please try again", "error");
      setSaving(false);
    }
  }

  function leave() {
    if (dirty) {
      setConfirmLeave(true);
      return;
    }
    router.push("/admin/products");
  }

  useSaveShortcut(() => {
    if (!saving) save();
  });

  // New products only — see useFormDraft.
  const draft = useFormDraft<ProductFormValues>({
    key: "product",
    values,
    enabled: !productId,
    dirty,
  });
  // save() is declared above the draft it has to clear, so it reaches the
  // clear function through a ref. Written after commit rather than during
  // render — a render can be discarded, and this ref outlives it.
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  const steps: WizardStep[] = [
    {
      id: "basics",
      title: "Basics",
      description: "Name, category and tagline",
      errorKeys: ["name", "slug", "category", "categoryLabel", "tagline"],
      complete: Boolean(values.name.en.trim() && values.slug.trim() && values.categoryLabel.en.trim() && values.tagline.en.trim()),
      content: (
          <Section
            title="Basics"
            description="Name, category and the one-line tagline shown on the card."
          >
            <BiField
              label="Product name"
              value={values.name}
              onChange={(v) => update("name", v)}
              errors={{ en: errors["name.en"], gu: errors["name.gu"] }}
              required
            />
            <SlugField
              value={values.slug}
              onChange={(v) => {
                setSlugTouched(true);
                update("slug", v);
              }}
              type="product"
              excludeId={productId}
              basePath="/products"
              error={errors.slug}
            />
            <SelectField
              label="Category"
              value={values.category}
              onChange={(v) => update("category", v)}
              options={[
                { value: "biostimulant", label: "Biostimulant" },
                { value: "mycorrhizal", label: "Mycorrhizal" },
                { value: "bacterial-consortia", label: "Bacterial consortia" },
                { value: "other", label: "Other" },
              ]}
              error={errors.category}
            />
            <BiField
              label="Category label (shown on the card)"
              value={values.categoryLabel}
              onChange={(v) => update("categoryLabel", v)}
              errors={{ en: errors["categoryLabel.en"] }}
              required
            />
            <BiField
              label="Tagline"
              value={values.tagline}
              onChange={(v) => update("tagline", v)}
              errors={{ en: errors["tagline.en"] }}
              required
            />
          </Section>
      ),
    },
    {
      id: "media",
      optional: true,
      title: "Media",
      description: "Pack shots and downloadable documents",
      errorKeys: ["images", "artFallback", "assets"],
      complete: values.images.length > 0,
      count: values.images.length + values.assets.length,
      content: (
        <>
            <Section
              title="Images"
              description="The image marked Primary is the one shown on the product card."
            >
              <ImageUploader
                images={values.images}
                onChange={(v) => update("images", v)}
                folder="products"
              />
              <SelectField
                label="Illustration when there is no photo"
                value={values.artFallback}
                onChange={(v) => update("artFallback", v as ProductFormValues["artFallback"])}
                options={[
                  { value: "sachet", label: "Sachet" },
                  { value: "roots", label: "Roots" },
                  { value: "network", label: "Network" },
                ]}
              />
            </Section>
            <Section
              title="Downloads"
              description="PDFs farmers can download or ask for on WhatsApp."
            >
              <FileUploader
                assets={values.assets}
                onChange={(assets) => update("assets", assets)}
                folder="products"
                errors={errors}
              />
            </Section>
        </>
      ),
    },
    {
      id: "details",
      title: "Details",
      description: "Description, benefits, dosage and crops",
      errorKeys: ["description", "benefits", "format", "complianceNote", "dosage", "suitableCrops", "cropsNote"],
      complete: Boolean(values.description.en.trim()),
      count: values.benefits.length,
      content: (
        <>
            <Section title="Description & benefits">
              <BiField
                label="Description"
                value={values.description}
                onChange={(v) => update("description", v)}
                multiline
                rows={5}
                errors={{ en: errors["description.en"] }}
                required
              />
              <FieldGroup label="Benefits" hint="Shown as bullets on the product page">
                <RepeatableList
                    items={values.benefits}
                    emptyLabel="No benefits yet."
                    addLabel="Add benefit"
                    onAdd={() => update("benefits", [...values.benefits, { ...EMPTY_BI }])}
                    onRemove={(i) =>
                      update("benefits", values.benefits.filter((_, idx) => idx !== i))
                    }
                    renderItem={(i) => (
                      <BiField
                        label={`Benefit ${i + 1}`}
                        value={values.benefits[i]}
                        onChange={(v) =>
                          update(
                            "benefits",
                            values.benefits.map((b, idx) => (idx === i ? v : b)),
                          )
                        }
                      />
                    )}
                  />
              </FieldGroup>
            </Section>
            <Section
              title="Dosage & crops"
              description="What a farmer needs to know before applying."
            >
              <BiField
                label="Dosage summary"
                value={values.dosage.summary}
                onChange={(v) => update("dosage", { ...values.dosage, summary: v })}
                multiline
                rows={2}
              />
              <BiField
                label="How to apply"
                value={values.dosage.applicationMethod}
                onChange={(v) =>
                  update("dosage", { ...values.dosage, applicationMethod: v })
                }
                multiline
                rows={3}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Amount per acre"
                  kind="decimal"
                  value={values.dosage.amountPerAcre ?? ""}
                  onChange={(v) => update("dosage", { ...values.dosage, amountPerAcre: v })}
                />
                <TextField
                  label="Unit"
                  value={values.dosage.unit}
                  onChange={(v) => update("dosage", { ...values.dosage, unit: v })}
                />
              </div>
              <BiField
                label="Suitable crops (sentence shown on the page)"
                value={values.cropsNote}
                onChange={(v) => update("cropsNote", v)}
                multiline
                rows={2}
              />
              <BiField
                label="Pack format (e.g. 25g sachet)"
                value={values.format}
                onChange={(v) => update("format", v)}
              />
            </Section>
        </>
      ),
    },
    {
      id: "howto",
      optional: true,
      title: "How to use",
      description: "The numbered photo strip",
      errorKeys: ["applicationSteps"],
      complete: values.applicationSteps.length > 0,
      count: values.applicationSteps.length,
      content: (
          <Section
            title="How to use"
            description="A numbered photo strip on the product page. Add the steps in order."
          >
            <RepeatableList
              items={values.applicationSteps}
              emptyLabel="No steps yet."
              addLabel="Add step"
              onAdd={() =>
                update("applicationSteps", [
                  ...values.applicationSteps,
                  {
                    image: { url: "", publicId: "" },
                    caption: { ...EMPTY_BI },
                    order: values.applicationSteps.length,
                  },
                ])
              }
              onRemove={(i) =>
                update(
                  "applicationSteps",
                  values.applicationSteps
                    .filter((_, idx) => idx !== i)
                    .map((s, idx) => ({ ...s, order: idx })),
                )
              }
              renderItem={(i) => (
                <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
                  <SingleImageField
                    label="Photo"
                    value={values.applicationSteps[i].image}
                    onChange={(image) =>
                      update(
                        "applicationSteps",
                        values.applicationSteps.map((s, idx) =>
                          idx === i ? { ...s, image } : s,
                        ),
                      )
                    }
                  />
                  <BiField
                    label="Caption"
                    value={values.applicationSteps[i].caption}
                    onChange={(caption) =>
                      update(
                        "applicationSteps",
                        values.applicationSteps.map((s, idx) =>
                          idx === i ? { ...s, caption } : s,
                        ),
                      )
                    }
                    multiline
                    rows={2}
                    errors={{
                      en: errors[`applicationSteps.${i}.caption.en`],
                    }}
                    required
                  />
                </div>
              )}
            />
          </Section>
      ),
    },
    {
      id: "proof",
      optional: true,
      title: "Results & FAQ",
      description: "Before/after pairs and common questions",
      errorKeys: ["fieldResults", "faqs"],
      complete: values.fieldResults.length > 0 || values.faqs.length > 0,
      count: values.fieldResults.length + values.faqs.length,
      content: (
        <>
            <Section
              title="Results from the field"
              description="Before/after photo pairs. These sit above the FAQ — they do more for sales than any other section."
            >
              <RepeatableList
                items={values.fieldResults}
                emptyLabel="No field results yet."
                addLabel="Add a before/after pair"
                onAdd={() =>
                  update("fieldResults", [
                    ...values.fieldResults,
                    {
                      beforeImage: { url: "", publicId: "" },
                      afterImage: { url: "", publicId: "" },
                      crop: "",
                      district: "",
                      description: { ...EMPTY_BI },
                      farmerName: "",
                    },
                  ])
                }
                onRemove={(i) =>
                  update(
                    "fieldResults",
                    values.fieldResults.filter((_, idx) => idx !== i),
                  )
                }
                renderItem={(i) => {
                  const row = values.fieldResults[i];
                  const patch = (change: Partial<typeof row>) =>
                    update(
                      "fieldResults",
                      values.fieldResults.map((r, idx) =>
                        idx === i ? { ...r, ...change } : r,
                      ),
                    );
                  return (
                    <div className="space-y-3">
                      <div className="grid max-w-xs grid-cols-2 gap-3">
                        <SingleImageField
                          label="Before"
                          value={row.beforeImage}
                          onChange={(beforeImage) => patch({ beforeImage })}
                          error={errors[`fieldResults.${i}.beforeImage.url`]}
                        />
                        <SingleImageField
                          label="After"
                          value={row.afterImage}
                          onChange={(afterImage) => patch({ afterImage })}
                        />
                      </div>
                      {errors[`fieldResults.${i}.beforeImage.url`] && (
                        <p className="text-xs font-semibold text-cta">
                          {errors[`fieldResults.${i}.beforeImage.url`]}
                        </p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-3">
                        <TextField
                          label="Crop"
                          value={row.crop}
                          onChange={(crop) => patch({ crop })}
                        />
                        <TextField
                          label="District"
                          value={row.district}
                          onChange={(district) => patch({ district })}
                        />
                        <TextField
                          label="Farmer (optional)"
                          value={row.farmerName}
                          onChange={(farmerName) => patch({ farmerName })}
                        />
                      </div>
                      <BiField
                        label="What changed"
                        value={row.description}
                        onChange={(description) => patch({ description })}
                        multiline
                        rows={2}
                        errors={{ en: errors[`fieldResults.${i}.description.en`] }}
                        required
                      />
                    </div>
                  );
                }}
              />
            </Section>
            <Section
              title="Common questions"
              description="Shown as an accordion, and published as FAQ structured data for Google."
            >
              <RepeatableList
                items={values.faqs}
                emptyLabel="No questions yet."
                addLabel="Add question"
                onAdd={() =>
                  update("faqs", [
                    ...values.faqs,
                    {
                      question: { ...EMPTY_BI },
                      answer: { ...EMPTY_BI },
                      order: values.faqs.length,
                    },
                  ])
                }
                onRemove={(i) =>
                  update(
                    "faqs",
                    values.faqs
                      .filter((_, idx) => idx !== i)
                      .map((f, idx) => ({ ...f, order: idx })),
                  )
                }
                renderItem={(i) => (
                  <div className="space-y-3">
                    <BiField
                      label="Question"
                      value={values.faqs[i].question}
                      onChange={(question) =>
                        update(
                          "faqs",
                          values.faqs.map((f, idx) =>
                            idx === i ? { ...f, question } : f,
                          ),
                        )
                      }
                      errors={{ en: errors[`faqs.${i}.question.en`] }}
                      required
                    />
                    <BiField
                      label="Answer"
                      value={values.faqs[i].answer}
                      onChange={(answer) =>
                        update(
                          "faqs",
                          values.faqs.map((f, idx) =>
                            idx === i ? { ...f, answer } : f,
                          ),
                        )
                      }
                      multiline
                      rows={3}
                      errors={{ en: errors[`faqs.${i}.answer.en`] }}
                      required
                    />
                  </div>
                )}
              />
            </Section>
        </>
      ),
    },
    {
      id: "related",
      optional: true,
      title: "Related",
      description: "Cross-links and pinned stories",
      errorKeys: ["relatedProducts", "pairsWellWith", "pinnedTestimonials"],
      complete: values.relatedProducts.length + values.pairsWellWith.length + values.pinnedTestimonials.length > 0,
      count: values.relatedProducts.length + values.pairsWellWith.length + values.pinnedTestimonials.length,
      content: (
          <Section
            title="Related & pinned"
            description="Cross-links and proof shown alongside this product."
          >
            <FieldGroup
              label="Use together"
              hint="Shown with the note under each card"
            >
              <RepeatableList
                items={values.pairsWellWith}
                emptyLabel="No pairings yet."
                addLabel="Add a pairing"
                onAdd={() =>
                  update("pairsWellWith", [
                    ...values.pairsWellWith,
                    { product: "", note: { ...EMPTY_BI } },
                  ])
                }
                onRemove={(i) =>
                  update(
                    "pairsWellWith",
                    values.pairsWellWith.filter((_, idx) => idx !== i),
                  )
                }
                renderItem={(i) => (
                  <div className="space-y-3">
                    <EntitySelect
                      label="Product"
                      options={otherProducts}
                      value={values.pairsWellWith[i].product}
                      onChange={(product) =>
                        update(
                          "pairsWellWith",
                          values.pairsWellWith.map((p, idx) =>
                            idx === i ? { ...p, product } : p,
                          ),
                        )
                      }
                      error={errors[`pairsWellWith.${i}.product`]}
                    />
                    <BiField
                      label="Note"
                      value={values.pairsWellWith[i].note}
                      onChange={(note) =>
                        update(
                          "pairsWellWith",
                          values.pairsWellWith.map((p, idx) =>
                            idx === i ? { ...p, note } : p,
                          ),
                        )
                      }
                      hint="e.g. Mycho at sowing + FloraMax at flowering"
                    />
                  </div>
                )}
              />
            </FieldGroup>

            <EntityPicker
              label="Related products"
              options={otherProducts}
              selected={values.relatedProducts}
              onChange={(ids) => update("relatedProducts", ids)}
              placeholder="Search products…"
              emptyLabel="No related products — the row at the page bottom is hidden."
            />

            <EntityPicker
              label="Pinned testimonials"
              options={testimonials}
              selected={values.pinnedTestimonials}
              onChange={(ids) => update("pinnedTestimonials", ids)}
              max={2}
              placeholder="Search published testimonials…"
              emptyLabel="No testimonials pinned to this product."
              error={errors.pinnedTestimonials}
            />
          </Section>
      ),
    },
    {
      id: "billing",
      optional: true,
      title: "Billing",
      description: "SKU, pack sizes and compliance",
      errorKeys: ["sku", "hsnCode", "gstRatePercent", "composition", "packSizes", "regulatory"],
      complete: values.packSizes.length > 0,
      count: values.packSizes.length,
      content: (
          <Section
            title="Billing & compliance"
            description="Stored for future invoicing. Dealer prices are never shown on the public site."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="SKU"
                kind="code" value={values.sku} onChange={(v) => update("sku", v)} />
              <TextField
                label="HSN code"
                kind="code"
                value={values.hsnCode}
                onChange={(v) => update("hsnCode", v)}
              />
              <TextField
                label="GST %"
                kind="decimal"
                min={0}
                max={28}
                value={values.gstRatePercent}
                onChange={(v) => update("gstRatePercent", v)}
              />
            </div>

            <FieldGroup label="Pack sizes" hint="Dealer price stays internal">
              <RepeatableList
                  items={values.packSizes}
                  emptyLabel="No pack sizes yet."
                  addLabel="Add pack size"
                  onAdd={() =>
                    update("packSizes", [
                      ...values.packSizes,
                      {
                        label: "",
                        netQuantity: "",
                        unit: "g",
                        mrp: "",
                        farmerPrice: "",
                        dealerPrice: "",
                        cost: "",
                      },
                    ])
                  }
                  onRemove={(i) =>
                    update("packSizes", values.packSizes.filter((_, idx) => idx !== i))
                  }
                  renderItem={(i) => (
                    <div className="grid gap-3 sm:grid-cols-5">
                      <TextField
                        label="Label"
                        value={values.packSizes[i].label}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, label: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Net qty"
                        kind="decimal"
                        value={values.packSizes[i].netQuantity ?? ""}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, netQuantity: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Unit"
                        value={values.packSizes[i].unit}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, unit: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="MRP"
                        kind="money"
                        prefix="₹"
                        value={values.packSizes[i].mrp ?? ""}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, mrp: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Farmer"
                        kind="money"
                        prefix="₹"
                        hint="What a farmer actually pays. Usually below MRP."
                        value={values.packSizes[i].farmerPrice ?? ""}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, farmerPrice: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Dealer"
                        kind="money"
                        prefix="₹"
                        value={values.packSizes[i].dealerPrice ?? ""}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, dealerPrice: v } : p,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Cost"
                        kind="money"
                        prefix="₹"
                        hint="What the pack costs to make and fill. Never shown publicly."
                        value={values.packSizes[i].cost ?? ""}
                        onChange={(v) =>
                          update(
                            "packSizes",
                            values.packSizes.map((p, idx) =>
                              idx === i ? { ...p, cost: v } : p,
                            ),
                          )
                        }
                      />
                      <PackMargins pack={values.packSizes[i]} />
                    </div>
                  )}
                />
            </FieldGroup>

            <FieldGroup label="Composition" hint="As printed on the label">
              <RepeatableList
                  items={values.composition}
                  emptyLabel="No ingredients listed yet."
                  addLabel="Add ingredient"
                  onAdd={() =>
                    update("composition", [
                      ...values.composition,
                      { ingredient: "", quantity: "" },
                    ])
                  }
                  onRemove={(i) =>
                    update(
                      "composition",
                      values.composition.filter((_, idx) => idx !== i),
                    )
                  }
                  renderItem={(i) => (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        label="Ingredient"
                        value={values.composition[i].ingredient}
                        onChange={(v) =>
                          update(
                            "composition",
                            values.composition.map((c, idx) =>
                              idx === i ? { ...c, ingredient: v } : c,
                            ),
                          )
                        }
                      />
                      <TextField
                        label="Quantity"
                        value={values.composition[i].quantity}
                        onChange={(v) =>
                          update(
                            "composition",
                            values.composition.map((c, idx) =>
                              idx === i ? { ...c, quantity: v } : c,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                />
            </FieldGroup>

            <Toggle
              label="FCO compliant"
              checked={values.regulatory.fcoCompliant}
              onChange={(v) =>
                update("regulatory", { ...values.regulatory, fcoCompliant: v })
              }
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="FCO schedule"
                value={values.regulatory.fcoSchedule}
                onChange={(v) =>
                  update("regulatory", { ...values.regulatory, fcoSchedule: v })
                }
              />
              <TextField
                label="Licence no."
                value={values.regulatory.licenseNo}
                onChange={(v) =>
                  update("regulatory", { ...values.regulatory, licenseNo: v })
                }
              />
            </div>
            <BiField
              label="Compliance note (shown on the product page)"
              value={values.complianceNote}
              onChange={(v) => update("complianceNote", v)}
              multiline
              rows={2}
            />
          </Section>
      ),
    },
    {
      id: "publishing",
      title: "Publishing",
      description: "Availability, status and order",
      errorKeys: ["whatsappMessage", "status", "featured", "displayOrder", "availability", "availabilityNote"],
      complete: values.status === 'published',
      content: (
          <Section title="Publishing">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Availability"
                value={values.availability}
                onChange={(v) =>
                  update("availability", v as ProductFormValues["availability"])
                }
                options={[
                  { value: "in_stock", label: "In stock" },
                  { value: "out_of_stock", label: "Out of stock" },
                  { value: "seasonal", label: "Seasonal" },
                ]}
                hint={
                  values.availability === "out_of_stock"
                    ? "The CTA becomes “Notify me on WhatsApp”."
                    : undefined
                }
              />
              <div />
            </div>
            {values.availability !== "in_stock" && (
              <BiField
                label="Availability note"
                value={values.availabilityNote}
                onChange={(v) => update("availabilityNote", v)}
                multiline
                rows={2}
                hint="Shown next to the badge, and in place of the usual CTA text when out of stock."
              />
            )}
            <TextareaField
              label="WhatsApp message"
              value={values.whatsappMessage}
              onChange={(v) => update("whatsappMessage", v)}
              hint="Pre-filled text when a farmer taps “Ask on WhatsApp”."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Status"
                value={values.status}
                onChange={(v) => update("status", v as "draft" | "published")}
                options={[
                  { value: "draft", label: "Draft (hidden)" },
                  { value: "published", label: "Published (live)" },
                ]}
              />
              <TextField
                label="Display order"
                kind="integer"
                min={0}
                value={values.displayOrder}
                onChange={(v) => update("displayOrder", v)}
                hint="Lower numbers appear first."
              />
            </div>
            <Toggle
              label="Featured product"
              checked={values.featured}
              onChange={(v) => update("featured", v)}
              hint="Leads the products page and the home page highlight."
            />
          </Section>
      ),
    },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      {draft.recoverable && (
        <DraftBanner
          savedAt={draft.recoverable.savedAt}
          onRestore={() => {
            if (draft.recoverable) setValues(draft.recoverable.values);
            setDirty(true);
            draft.clear();
          }}
          onDiscard={draft.clear}
        />
      )}

      {formError && <ErrorBanner message={formError} />}

      <FormWizard
        steps={steps}
        errors={errors}
        saving={saving}
        dirty={dirty}
        submitLabel={productId ? "Save changes" : "Create product"}
        onCancel={leave}
        aside={
          /* Live preview — the real public ProductCard, not a lookalike. */
          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="admin-card p-4">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-mid opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
                </span>
                Live preview
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Exactly how this card appears on the site.
              </p>
              <div className="mt-3">
                <ProductCard
                  linkToDetail={false}
                  product={{
                    slug: values.slug,
                    name: values.name.en
                      ? values.name
                      : { en: "Product name", gu: "" },
                    categoryLabel: values.categoryLabel,
                    tagline: values.tagline,
                    imageUrl: previewImage,
                    artFallback: values.artFallback,
                    featured: values.featured,
                  }}
                />
              </div>
            </div>
          </aside>
        }
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="Your edits to this product have not been saved. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push("/admin/products");
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
