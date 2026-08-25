"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { useToast } from "./Toast";
import { ErrorBanner, Spinner } from "./ui";

export interface AdminImage {
  url: string;
  publicId: string;
  alt: Bi;
  isPrimary: boolean;
}

/**
 * Uploads straight from the browser to Cloudinary using a signature minted
 * by /api/admin/sign-upload — the file never touches our server, and the API
 * secret never reaches the client. Only url + public_id are kept.
 */
async function uploadToCloudinary(
  file: File,
  folder: "products" | "testimonials" | "blog",
): Promise<{ url: string; publicId: string }> {
  const signResponse = await fetch("/api/admin/sign-upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ folder }),
  });
  const signed = await signResponse.json();
  if (!signResponse.ok) {
    throw new Error(signed.error ?? "Could not start the upload");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("folder", signed.folder);

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const result = await uploadResponse.json();
  if (!uploadResponse.ok) {
    throw new Error(result?.error?.message ?? "Cloudinary rejected the upload");
  }
  return { url: result.secure_url as string, publicId: result.public_id as string };
}

export function ImageUploader({
  images,
  onChange,
  folder = "products",
  max = 6,
}: {
  images: AdminImage[];
  onChange: (images: AdminImage[]) => void;
  folder?: "products" | "testimonials" | "blog";
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const full = images.length >= max;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const room = Math.max(0, max - images.length);
    const chosen = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, room);

    if (chosen.length === 0) {
      const message = full
        ? `You can upload at most ${max} images.`
        : "Those files are not images.";
      setError(message);
      toast(message, "error");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: chosen.length });
    const uploaded: AdminImage[] = [];
    try {
      for (const file of chosen) {
        const { url, publicId } = await uploadToCloudinary(file, folder);
        uploaded.push({ url, publicId, alt: { en: "", gu: "" }, isPrimary: false });
        setProgress({ done: uploaded.length, total: chosen.length });
      }
      toast(
        `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Upload failed";
      setError(message);
      toast(message, "error");
    } finally {
      // Keep whatever made it through before the failure.
      if (uploaded.length > 0) {
        const next = [...images, ...uploaded];
        if (!next.some((i) => i.isPrimary)) next[0].isPrimary = true;
        onChange(next);
      }
      setBusy(false);
      setProgress(null);
      setDropActive(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    const next = images.filter((_, i) => i !== index);
    if (!next.some((i) => i.isPrimary) && next.length > 0) next[0].isPrimary = true;
    onChange(next);
  }

  function makePrimary(index: number) {
    onChange(images.map((img, i) => ({ ...img, isPrimary: i === index })));
  }

  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Drop zone — click or drag files in. */}
      <button
        type="button"
        onClick={() => !full && inputRef.current?.click()}
        disabled={busy || full}
        onDragOver={(e) => {
          e.preventDefault();
          if (!full && !busy) setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          if (full || busy) return;
          handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          dropActive
            ? "border-olive bg-laurel-light/30"
            : "border-camel bg-meringue-light/45 hover:border-olive hover:bg-laurel-light/20"
        } ${full || busy ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      >
        {busy ? (
          <>
            <Spinner />
            <span className="text-sm font-semibold text-russet">
              Uploading {progress ? `${progress.done + 1} of ${progress.total}` : "…"}
            </span>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-olive"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span className="text-sm font-semibold text-russet">
              {full
                ? max === 1
                  ? "Image added — remove it to swap"
                  : `Limit of ${max} images reached`
                : max === 1
                  ? "Click or drop an image here"
                  : "Click or drop images here"}
            </span>
            <span className="text-xs text-russet-dark/55">
              {images.length}/{max} uploaded · JPG or PNG
              {max > 1 && " · drag thumbnails to reorder"}
            </span>
          </>
        )}
      </button>

      {busy && progress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-meringue-dark/40">
          <div
            className="h-full rounded-full bg-olive transition-[width] duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      )}

      <ErrorBanner message={error} />

      {images.length > 0 && (
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {images.map((img, index) => (
            <li
              key={img.publicId || img.url}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={`group overflow-hidden rounded-xl border bg-white transition-all ${
                img.isPrimary
                  ? "border-alloy ring-2 ring-alloy/20"
                  : "border-camel-light/70"
              } ${dragIndex === index ? "scale-[0.97] opacity-60" : ""}`}
            >
              <div className="relative aspect-4/3 bg-meringue-light">
                <Image
                  src={cldUrl(img.url, CLD.thumb) ?? img.url}
                  alt={img.alt.en || "Product image"}
                  fill
                  unoptimized
                  className="cursor-move object-cover"
                />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 rounded-full bg-alloy px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cornsilk-light shadow-sm">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove image"
                  className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-russet-dark/60 opacity-0 shadow-sm transition-opacity hover:text-alloy-dark focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
                  </svg>
                </button>
              </div>
              <div className="space-y-2 p-2.5">
                <input
                  value={img.alt.en}
                  placeholder="Alt text (English)"
                  onChange={(e) =>
                    onChange(
                      images.map((it, i) =>
                        i === index
                          ? { ...it, alt: { ...it.alt, en: e.target.value } }
                          : it,
                      ),
                    )
                  }
                  className="admin-input px-2 py-1 text-xs"
                />
                <input
                  value={img.alt.gu ?? ""}
                  placeholder="Alt text (ગુજરાતી)"
                  onChange={(e) =>
                    onChange(
                      images.map((it, i) =>
                        i === index
                          ? { ...it, alt: { ...it.alt, gu: e.target.value } }
                          : it,
                      ),
                    )
                  }
                  className="admin-input px-2 py-1 text-xs"
                />
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => makePrimary(index)}
                    className="w-full rounded-lg py-1 text-xs font-semibold text-olive-dark transition-colors hover:bg-laurel-light/40"
                  >
                    Make primary
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
