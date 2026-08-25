"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Bi } from "@/lib/content";
import { slugify } from "@/lib/schemas";
import { ImageUploader, type AdminImage } from "./ImageUploader";
import { BiField, Button, Section, SelectField, TextField } from "./ui";

// Tiptap is ~100 kB — loaded only when an admin opens the editor, so it
// never touches the public bundle.
const RichTextEditor = dynamic(
  () => import("./RichTextEditor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[320px] rounded-lg border border-camel-light bg-white p-4 text-sm text-russet-dark/50">
        Loading editor…
      </div>
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
  const [values, setValues] = useState(initial);
  const [lang, setLang] = useState<"en" | "gu">("en");
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
        setSaving(false);
        return;
      }
      setDirty(false);
      router.push("/admin/blog");
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
      className="max-w-4xl space-y-6"
    >
      {formError && (
        <p
          role="alert"
          className="rounded-lg border border-alloy/40 bg-alloy/10 px-4 py-3 text-sm font-medium text-russet"
        >
          {formError}
        </p>
      )}

      <Section title="Article">
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
        <div className="flex gap-2">
          {(["en", "gu"] as const).map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                lang === code
                  ? "bg-olive text-cornsilk-light"
                  : "border border-camel-light text-russet-dark hover:bg-meringue"
              }`}
            >
              {code === "en" ? "English" : "ગુજરાતી"}
              {values.content[code] ? "" : " (empty)"}
            </button>
          ))}
        </div>
        <RichTextEditor
          key={lang}
          value={values.content[lang] ?? ""}
          onChange={(html) =>
            update("content", { ...values.content, [lang]: html })
          }
        />
        {errors["content.en"] && (
          <p className="text-xs font-medium text-alloy-dark">
            {errors["content.en"]}
          </p>
        )}
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

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : postId ? "Save changes" : "Create post"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (!dirty || window.confirm("Discard unsaved changes?")) {
              router.push("/admin/blog");
            }
          }}
        >
          Cancel
        </Button>
        {dirty && <span className="text-xs text-russet-dark/60">Unsaved changes</span>}
      </div>
    </form>
  );
}
