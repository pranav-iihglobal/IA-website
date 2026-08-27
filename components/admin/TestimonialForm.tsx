"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { parseVideoEmbedId } from "@/lib/schemas";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { useToast } from "./Toast";
import {
  BiField,
  ErrorBanner,
  Section,
  SelectField,
  TextField,
  Toggle,
} from "./ui";

const EMPTY_BI: Bi = { en: "", gu: "" };

export interface TestimonialFormValues {
  farmerName: Bi;
  village: string;
  taluka: string;
  district: string;
  crop: Bi;
  quote: Bi;
  photo: { url: string; publicId: string };
  video: { platform: string; url: string; embedId: string };
  productUsed: string | null;
  rating: number | string | null;
  source: "admin_entered" | "whatsapp_submission";
  verified: boolean;
  verifiedVia: "whatsapp" | "field_visit" | "photo" | "";
  status: "draft" | "published";
  featured: boolean;
  displayOrder: number | string;
}

export const EMPTY_TESTIMONIAL: TestimonialFormValues = {
  farmerName: { ...EMPTY_BI },
  village: "",
  taluka: "",
  district: "",
  crop: { ...EMPTY_BI },
  quote: { ...EMPTY_BI },
  photo: { url: "", publicId: "" },
  video: { platform: "", url: "", embedId: "" },
  productUsed: null,
  rating: "",
  source: "admin_entered",
  verified: false,
  verifiedVia: "",
  status: "draft",
  featured: false,
  displayOrder: 0,
};

export function TestimonialForm({
  initial,
  testimonialId,
  products,
}: {
  initial: TestimonialFormValues;
  testimonialId?: string;
  products: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  // save() is defined before the draft hook; the ref bridges the two.
  const clearDraft = useRef<() => void>(() => {});

  function update<K extends keyof TestimonialFormValues>(
    key: K,
    value: TestimonialFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setDirty(true);
  }

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Immediate feedback on the pasted video link.
  const videoValid =
    !values.video.url ||
    (values.video.platform &&
      Boolean(parseVideoEmbedId(values.video.platform, values.video.url)));

  // The uploader works in lists; a testimonial has at most one photo.
  const photoAsImages: AdminImage[] = values.photo.url
    ? [
        {
          url: values.photo.url,
          publicId: values.photo.publicId,
          alt: { en: "", gu: "" },
          isPrimary: true,
        },
      ]
    : [];

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const payload = {
        ...values,
        rating:
          values.rating === "" || values.rating === null
            ? null
            : Number(values.rating),
        displayOrder: Number(values.displayOrder) || 0,
        productUsed: values.productUsed || null,
      };
      const result = await adminFetch<{ id: string }>(
        testimonialId
          ? `/api/admin/testimonials/${testimonialId}`
          : "/api/admin/testimonials",
        {
          method: testimonialId ? "PATCH" : "POST",
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
        testimonialId
          ? "Testimonial saved"
          : `Testimonial from “${values.farmerName.en}” added`,
      );
      router.push("/admin/testimonials");
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
    router.push("/admin/testimonials");
  }

  useSaveShortcut(() => {
    if (!saving) save();
  });

  // New testimonials only — see useFormDraft.
  const draft = useFormDraft<TestimonialFormValues>({
    key: "testimonial",
    values,
    enabled: !testimonialId,
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
      id: "farmer",
      title: "Farmer",
      description: "Who the story belongs to",
      errorKeys: ["farmerName", "village", "taluka", "district", "crop"],
      complete: Boolean(values.farmerName.en.trim()),
      content: (
        <Section title="Farmer" description="Who the story belongs to.">
          <BiField
            label="Farmer name"
            value={values.farmerName}
            onChange={(v) => update("farmerName", v)}
            errors={{ en: errors["farmerName.en"] }}
            required
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Village"
              value={values.village}
              onChange={(v) => update("village", v)}
            />
            <TextField
              label="Taluka"
              value={values.taluka}
              onChange={(v) => update("taluka", v)}
            />
            <TextField
              label="District"
              value={values.district}
              onChange={(v) => update("district", v)}
              hint="Used by the district filter on the public page."
            />
          </div>
          <BiField
            label="Crop"
            value={values.crop}
            onChange={(v) => update("crop", v)}
          />
        </Section>
      ),
    },
    {
      id: "words",
      title: "Their words",
      description: "Quote and video",
      errorKeys: ["quote", "video"],
      complete: Boolean(values.quote.en.trim() || values.video.url.trim()),
      content: (
        <Section title="Their words" description="Add a quote, a video, or both.">
          <BiField
            label="Quote"
            value={values.quote}
            onChange={(v) => update("quote", v)}
            multiline
            rows={4}
            errors={{ en: errors["quote.en"] }}
          />
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <SelectField
              label="Video platform"
              value={values.video.platform}
              onChange={(v) => update("video", { ...values.video, platform: v })}
              options={[
                { value: "", label: "No video" },
                { value: "youtube", label: "YouTube" },
                { value: "instagram", label: "Instagram" },
                { value: "facebook", label: "Facebook" },
              ]}
              error={errors["video.platform"]}
            />
            <TextField
              label="Video link"
              value={values.video.url}
              onChange={(v) => update("video", { ...values.video, url: v })}
              placeholder="https://…"
              error={
                errors["video.url"] ??
                (values.video.url && !videoValid
                  ? "That does not look like a valid link for the chosen platform."
                  : undefined)
              }
              success={
                values.video.url && videoValid ? "Link looks good." : undefined
              }
              hint="Paste the full link from the app's share button."
            />
          </div>
        </Section>
      ),
    },
    {
      id: "photo",
      optional: true,
      title: "Photo",
      // The rail already appends "· optional" — don't say it twice.
      description: "A headshot of the farmer",
      errorKeys: ["photo"],
      complete: Boolean(values.photo.url),
      content: (
        <Section title="Photo" description="Optional — shown beside the name.">
          <ImageUploader
            images={photoAsImages}
            folder="testimonials"
            max={1}
            onChange={(imgs) =>
              update(
                "photo",
                imgs[0]
                  ? { url: imgs[0].url, publicId: imgs[0].publicId }
                  : { url: "", publicId: "" },
              )
            }
          />
        </Section>
      ),
    },
    {
      id: "verification",
      optional: true,
      title: "Verification",
      description: "How this story was checked",
      errorKeys: ["source", "verified", "verifiedVia"],
      // Untouched means not done — an unverified story should not read as
      // finished just because "unverified" happens to be valid.
      complete: values.verified && Boolean(values.verifiedVia),
      content: (
        <Section
          title="Verification"
          description="An editorial mark, set by hand. Only tick it once someone at IKSARVA has actually confirmed the story."
        >
          <SelectField
            label="How this story reached us"
            value={values.source}
            onChange={(v) => update("source", v as TestimonialFormValues["source"])}
            options={[
              { value: "admin_entered", label: "Entered by admin" },
              {
                value: "whatsapp_submission",
                label: "Sent by the farmer on WhatsApp",
              },
            ]}
          />
          <Toggle
            label="Verified"
            checked={values.verified}
            onChange={(v) => update("verified", v)}
            hint="Shows a ✓ badge beside the farmer's name."
          />
          {values.verified && (
            <SelectField
              label="Verified how"
              value={values.verifiedVia}
              onChange={(v) =>
                update("verifiedVia", v as TestimonialFormValues["verifiedVia"])
              }
              options={[
                { value: "", label: "Choose…" },
                { value: "whatsapp", label: "On WhatsApp" },
                { value: "field_visit", label: "By field visit" },
                { value: "photo", label: "By photo" },
              ]}
              error={errors.verifiedVia}
              hint="The badge names the method, so it has to be true."
            />
          )}
        </Section>
      ),
    },
    {
      id: "publishing",
      title: "Publishing",
      description: "Product link, order and status",
      errorKeys: ["productUsed", "rating", "status", "featured", "displayOrder"],
      complete: values.status === "published",
      content: (
        <Section title="Publishing">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Product used"
              value={values.productUsed ?? ""}
              onChange={(v) => update("productUsed", v || null)}
              options={[
                { value: "", label: "Not linked" },
                ...products.map((p) => ({ value: p.id, label: p.name })),
              ]}
              hint="Also powers the product filter on the public page."
            />
            <TextField
              label="Rating (1–5, optional)"
              type="number"
              value={values.rating ?? ""}
              onChange={(v) => update("rating", v)}
              error={errors.rating}
            />
          </div>
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
            label="Featured"
            checked={values.featured}
            onChange={(v) => update("featured", v)}
            hint="Featured testimonials are shown first."
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
        submitLabel={testimonialId ? "Save changes" : "Add testimonial"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This testimonial has unsaved edits. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push("/admin/testimonials");
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
