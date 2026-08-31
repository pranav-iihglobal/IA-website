"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { POST_CATEGORIES } from "@/lib/content";
import { slugify } from "@/lib/schemas";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import { adminFetch } from "@/lib/admin/fetch";
import { useFormDraft, useSaveShortcut } from "@/lib/admin/form-hooks";
import { EntityPicker, type PickerOption } from "./EntityPicker";
import { ConfirmDialog } from "./ConfirmDialog";
import { DraftBanner } from "./DraftBanner";
import { FormWizard, type WizardStep } from "./FormWizard";
import { SlugField } from "./SlugField";
import { useToast } from "./Toast";
import {
  BiField,
  ErrorBanner,
  FieldError,
  Section,
  SelectField,
  TextField,
} from "./ui";

// Tiptap is ~100 kB — loaded only when an admin opens the editor, so it
// never touches the public bundle.
const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="admin-skeleton min-h-[320px] rounded-xl" />
    ),
  },
);

const EMPTY_BI: Bi = { en: "", gu: "" };

export interface PostFormValues {
  title: Bi;
  slug: string;
  excerpt: Bi;
  content: Bi;
  coverImage: { url: string; publicId: string; alt: Bi };
  tags: string[];
  category: string;
  status: "draft" | "published" | "scheduled";
  publishAt: string | null;
  author: string;
  metaTitle: Bi;
  metaDescription: Bi;
  pinnedTestimonials: string[];
}

export const EMPTY_POST: PostFormValues = {
  title: { ...EMPTY_BI },
  slug: "",
  excerpt: { ...EMPTY_BI },
  content: { ...EMPTY_BI },
  coverImage: { url: "", publicId: "", alt: { ...EMPTY_BI } },
  tags: [],
  category: "other",
  status: "draft",
  publishAt: null,
  author: "IKSARVA Team",
  metaTitle: { ...EMPTY_BI },
  metaDescription: { ...EMPTY_BI },
  pinnedTestimonials: [],
};

export function PostForm({
  initial,
  postId,
  testimonials = [],
}: {
  initial: PostFormValues;
  postId?: string;
  /** Published testimonials, for pinning to the end of the post. */
  testimonials?: PickerOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [lang, setLang] = useState<"en" | "gu">("en");
  const [confirmLeave, setConfirmLeave] = useState(false);
  // save() is defined before the draft hook; the ref bridges the two.
  const clearDraft = useRef<() => void>(() => {});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));

  function update<K extends keyof PostFormValues>(
    key: K,
    value: PostFormValues[K],
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

  useEffect(() => {
    if (slugTouched) return;
    setValues((v) => ({ ...v, slug: slugify(v.title.en) }));
  }, [values.title.en, slugTouched]);

  const coverAsImages: AdminImage[] = values.coverImage.url
    ? [
        {
          url: values.coverImage.url,
          publicId: values.coverImage.publicId,
          alt: values.coverImage.alt,
          isPrimary: true,
        },
      ]
    : [];

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);
    try {
      const result = await adminFetch<{ id: string }>(
        postId ? `/api/admin/posts/${postId}` : "/api/admin/posts",
        {
          method: postId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...values,
            publishAt: values.publishAt || null,
          }),
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
        postId ? `“${values.title.en}” saved` : `“${values.title.en}” created`,
      );
      router.push("/admin/blog");
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
    router.push("/admin/blog");
  }


  useSaveShortcut(() => {
    if (!saving) save();
  });

  // New posts only — see useFormDraft.
  const draft = useFormDraft<PostFormValues>({
    key: "post",
    values,
    enabled: !postId,
    dirty,
  });
  // save() is declared above the draft it has to clear, so it reaches the
  // clear function through a ref. Written after commit rather than during
  // render — a render can be discarded, and this ref outlives it.
  useEffect(() => {
    clearDraft.current = draft.clear;
  }, [draft.clear]);

  const hasContent = Boolean(
    values.content.en?.trim() || values.content.gu?.trim(),
  );

  const steps: WizardStep[] = [
    {
      id: "article",
      title: "Article",
      description: "Title, URL and list preview",
      errorKeys: ["title", "slug", "excerpt"],
      complete: Boolean(values.title.en.trim() && values.slug.trim()),
      content: (
        <Section title="Article" description="Title, URL and the list preview.">
          <BiField
            label="Title"
            value={values.title}
            onChange={(v) => update("title", v)}
            errors={{ en: errors["title.en"] }}
            required
          />
          <SlugField
            value={values.slug}
            onChange={(v) => {
              setSlugTouched(true);
              update("slug", v);
            }}
            type="post"
            excludeId={postId}
            basePath="/learn"
            error={errors.slug}
          />
          <BiField
            label="Excerpt (shown in the list and search results)"
            value={values.excerpt}
            onChange={(v) => update("excerpt", v)}
            multiline
            rows={2}
          />
        </Section>
      ),
    },
    {
      id: "cover",
      optional: true,
      title: "Cover image",
      description: "Shown on the list and when shared",
      errorKeys: ["coverImage"],
      complete: Boolean(values.coverImage.url),
      content: (
        <Section title="Cover image">
          <ImageUploader
            images={coverAsImages}
            folder="blog"
            max={1}
            onChange={(imgs) =>
              update(
                "coverImage",
                imgs[0]
                  ? {
                      url: imgs[0].url,
                      publicId: imgs[0].publicId,
                      alt: imgs[0].alt,
                    }
                  : { url: "", publicId: "", alt: { ...EMPTY_BI } },
              )
            }
          />
        </Section>
      ),
    },
    {
      id: "content",
      title: "Content",
      description: "The article itself",
      errorKeys: ["content"],
      complete: hasContent,
      content: (
        <Section
          title="Content"
          description="Write each language separately. If Gujarati is left empty, English is shown to everyone."
        >
          <div
            role="group"
            aria-label="Content language"
            className="inline-flex rounded-full bg-surface-muted p-1 ring-1 ring-line-soft/70"
          >
            {(["en", "gu"] as const).map((code) => {
              const active = lang === code;
              const filled = Boolean(values.content[code]?.trim());
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLang(code)}
                  className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-raised text-ink-strong shadow-sm"
                      : "text-ink-muted hover:text-ink-strong"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${filled ? "bg-olive" : "bg-camel"}`}
                    title={filled ? "Has content" : "Empty"}
                  />
                  {code === "en" ? "English" : "ગુજરાતી"}
                </button>
              );
            })}
          </div>
          <RichTextEditor
            key={lang}
            value={values.content[lang] ?? ""}
            onChange={(html) =>
              update("content", { ...values.content, [lang]: html })
            }
          />
          <FieldError message={errors["content.en"]} />
        </Section>
      ),
    },
    {
      id: "proof",
      optional: true,
      title: "Farmer proof",
      description: "Pinned testimonials",
      errorKeys: ["pinnedTestimonials"],
      complete: values.pinnedTestimonials.length > 0,
      count: values.pinnedTestimonials.length,
      content: (
        <Section
          title="Farmer proof"
          description="Pinned stories render as compact quote cards at the end of the post."
        >
          <EntityPicker
            label="Pinned testimonials"
            options={testimonials}
            selected={values.pinnedTestimonials}
            onChange={(ids) => update("pinnedTestimonials", ids)}
            max={2}
            placeholder="Search published testimonials…"
            emptyLabel="No testimonials pinned to this post."
            error={errors.pinnedTestimonials}
          />
        </Section>
      ),
    },
    {
      id: "publishing",
      title: "Publishing",
      description: "Category, tags and schedule",
      errorKeys: ["category", "tags", "status", "publishAt", "author"],
      complete: values.status !== "draft",
      content: (
        <Section title="Publishing">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Category"
              value={values.category}
              onChange={(v) => update("category", v)}
              options={[
                // Same map the public pages render, so the two cannot drift.
                ...Object.entries(POST_CATEGORIES).map(([value, label]) => ({
                  value,
                  label: label.en,
                })),
              ]}
            />
            <TextField
              label="Tags (comma separated)"
              value={values.tags.join(", ")}
              onChange={(v) =>
                update(
                  "tags",
                  v.split(",").map((t) => t.trim()).filter(Boolean),
                )
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Status"
              value={values.status}
              onChange={(v) => update("status", v as PostFormValues["status"])}
              options={[
                { value: "draft", label: "Draft (hidden)" },
                { value: "published", label: "Published (live now)" },
                { value: "scheduled", label: "Scheduled" },
              ]}
            />
            <TextField
              label="Publish at"
              type="datetime-local"
              value={values.publishAt ?? ""}
              onChange={(v) => update("publishAt", v || null)}
              hint={
                values.status === "scheduled"
                  ? "The article appears automatically at this time."
                  : "Used as the article date."
              }
              error={errors.publishAt}
            />
          </div>
          <TextField
            label="Author"
            value={values.author}
            onChange={(v) => update("author", v)}
          />
        </Section>
      ),
    },
    {
      id: "seo",
      optional: true,
      title: "SEO",
      description: "Search and share preview",
      errorKeys: ["metaTitle", "metaDescription"],
      // The excerpt lives on the Article step; only fields owned here count.
      complete: Boolean(
        values.metaTitle.en.trim() || values.metaDescription.en.trim(),
      ),
      content: (
        <Section
          title="SEO"
          description="Optional — falls back to the title and excerpt."
        >
          <BiField
            label="Meta title"
            value={values.metaTitle}
            onChange={(v) => update("metaTitle", v)}
            hint="Around 60 characters shows in full on Google."
          />
          <BiField
            label="Meta description"
            value={values.metaDescription}
            onChange={(v) => update("metaDescription", v)}
            multiline
            rows={2}
            hint="Around 155 characters shows in full on Google."
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
        submitLabel={postId ? "Save changes" : "Create post"}
        onCancel={leave}
      />

      <ConfirmDialog
        open={confirmLeave}
        title="Discard unsaved changes?"
        message="This article has unsaved edits. Leaving now loses them."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          router.push("/admin/blog");
        }}
        onCancel={() => setConfirmLeave(false)}
      />
    </form>
  );
}
