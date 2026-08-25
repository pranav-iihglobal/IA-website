"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Bi } from "@/lib/content";
import { slugify } from "@/lib/schemas";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import {
  BiField,
  ErrorBanner,
  FieldError,
  FormActions,
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
};

export function PostForm({
  initial,
  postId,
}: {
  initial: PostFormValues;
  postId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState(initial);
  const [lang, setLang] = useState<"en" | "gu">("en");
  const [confirmLeave, setConfirmLeave] = useState(false);
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
      const response = await fetch(
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFormError(data.error ?? "Could not save");
        if (data.fields) setErrors(data.fields);
        toast(data.error ?? "Could not save — check the highlighted fields", "error");
        setSaving(false);
        return;
      }
      setDirty(false);
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="max-w-4xl space-y-6"
    >
      {formError && (
        <div className="-mt-4">
          <ErrorBanner message={formError} />
        </div>
      )}

      <Section title="Article" description="Title, URL and the list preview.">
        <BiField
          label="Title"
          value={values.title}
          onChange={(v) => update("title", v)}
          errors={{ en: errors["title.en"] }}
          required
        />
        <TextField
          label="URL slug"
          value={values.slug}
          onChange={(v) => {
            setSlugTouched(true);
            update("slug", v);
          }}
          hint={`Public URL: /learn/${values.slug || "…"}`}
          error={errors.slug}
          required
        />
        <BiField
          label="Excerpt (shown in the list and search results)"
          value={values.excerpt}
          onChange={(v) => update("excerpt", v)}
          multiline
          rows={2}
        />
      </Section>

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

      <Section
        title="Content"
        description="Write each language separately. If Gujarati is left empty, English is shown to everyone."
      >
        <div
          role="tablist"
          aria-label="Content language"
          className="inline-flex rounded-full bg-meringue-light p-1 ring-1 ring-camel-light/70"
        >
          {(["en", "gu"] as const).map((code) => {
            const active = lang === code;
            const filled = Boolean(values.content[code]?.trim());
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLang(code)}
                className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-white text-russet shadow-sm"
                    : "text-russet-dark/60 hover:text-russet"
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

      <Section title="Publishing">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Category"
            value={values.category}
            onChange={(v) => update("category", v)}
            options={[
              { value: "soil-health", label: "Soil health" },
              { value: "crop-guides", label: "Crop guides" },
              { value: "company-news", label: "Company news" },
              { value: "other", label: "Other" },
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

      <Section title="SEO" description="Optional — falls back to the title and excerpt.">
        <BiField
          label="Meta title"
          value={values.metaTitle}
          onChange={(v) => update("metaTitle", v)}
        />
        <BiField
          label="Meta description"
          value={values.metaDescription}
          onChange={(v) => update("metaDescription", v)}
          multiline
          rows={2}
        />
      </Section>

      <FormActions
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
