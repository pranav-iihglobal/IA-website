"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Bi } from "@/lib/content";
import { slugify } from "@/lib/schemas";
import { ProductCard } from "@/components/ProductCard";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import {
  BiField,
  Button,
  RepeatableList,
  Section,
  SelectField,
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
    mrp?: number | string;
    dealerPrice?: number | string;
  }[];
  regulatory: { fcoCompliant: boolean; fcoSchedule: string; licenseNo: string };
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
  images: [],
  artFallback: "sachet",
  status: "draft",
  featured: false,
  displayOrder: 0,
};

export function ProductForm({
  initial,
  productId,
}: {
  initial: ProductFormValues;
  productId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));

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
        packSizes: values.packSizes.map((p) => ({
          ...p,
          netQuantity: p.netQuantity === "" ? undefined : Number(p.netQuantity),
          mrp: p.mrp === "" ? undefined : Number(p.mrp),
          dealerPrice: p.dealerPrice === "" ? undefined : Number(p.dealerPrice),
        })),
      };

      const response = await fetch(
        productId ? `/api/admin/products/${productId}` : "/api/admin/products",
        {
          method: productId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(data.error ?? "Could not save");
        if (data.fields) setErrors(data.fields);
        setSaving(false);
        return;
      }

      setDirty(false);
      router.push("/admin/products");
      router.refresh();
    } catch {
      setFormError("Network error — please try again");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <div className="space-y-6">
        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-alloy/40 bg-alloy/10 px-4 py-3 text-sm font-medium text-russet"
          >
            {formError}
          </p>
        )}

        <Section title="Basics">
          <BiField
            label="Product name"
            value={values.name}
            onChange={(v) => update("name", v)}
            errors={{ en: errors["name.en"], gu: errors["name.gu"] }}
            required
          />
          <TextField
            label="URL slug"
            value={values.slug}
            onChange={(v) => {
              setSlugTouched(true);
              update("slug", v);
            }}
            hint={`Public URL: /products/${values.slug || "…"}`}
            error={errors.slug}
            required
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

        <Section title="Images">
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
          <div>
            <span className="text-sm font-semibold text-russet">Benefits</span>
            <div className="mt-2">
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
            </div>
          </div>
        </Section>

        <Section title="Dosage & crops">
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
              type="number"
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

        <Section
          title="Billing & compliance"
          description="Stored for future invoicing. Dealer prices are never shown on the public site."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="SKU" value={values.sku} onChange={(v) => update("sku", v)} />
            <TextField
              label="HSN code"
              value={values.hsnCode}
              onChange={(v) => update("hsnCode", v)}
            />
            <TextField
              label="GST %"
              type="number"
              value={values.gstRatePercent}
              onChange={(v) => update("gstRatePercent", v)}
            />
          </div>

          <div>
            <span className="text-sm font-semibold text-russet">Pack sizes</span>
            <div className="mt-2">
              <RepeatableList
                items={values.packSizes}
                emptyLabel="No pack sizes yet."
                addLabel="Add pack size"
                onAdd={() =>
                  update("packSizes", [
                    ...values.packSizes,
                    { label: "", netQuantity: "", unit: "g", mrp: "", dealerPrice: "" },
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
                      type="number"
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
                      label="MRP ₹"
                      type="number"
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
                      label="Dealer ₹"
                      type="number"
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
                  </div>
                )}
              />
            </div>
          </div>

          <div>
            <span className="text-sm font-semibold text-russet">Composition</span>
            <div className="mt-2">
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
            </div>
          </div>

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

        <Section title="Publishing">
          <TextField
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
              type="number"
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : productId ? "Save changes" : "Create product"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (
                !dirty ||
                window.confirm("Discard unsaved changes?")
              ) {
                router.push("/admin/products");
              }
            }}
          >
            Cancel
          </Button>
          {dirty && (
            <span className="text-xs text-russet-dark/60">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Live preview — the real public ProductCard, not a lookalike. */}
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-widest text-olive">
          Live preview
        </p>
        <p className="mt-1 text-xs text-russet-dark/60">
          Exactly how this card appears on the site.
        </p>
        <div className="mt-3">
          <ProductCard
            linkToDetail={false}
            product={{
              slug: values.slug,
              name: values.name.en ? values.name : { en: "Product name", gu: "" },
              categoryLabel: values.categoryLabel,
              tagline: values.tagline,
              imageUrl: previewImage,
              artFallback: values.artFallback,
              featured: values.featured,
            }}
          />
        </div>
      </aside>
    </form>
  );
}
