"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { CLD, cldUrl } from "@/lib/images";
import { Button } from "./ui";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const room = Math.max(0, max - images.length);
      const chosen = Array.from(files).slice(0, room);
      const uploaded: AdminImage[] = [];
      for (const file of chosen) {
        if (!file.type.startsWith("image/")) continue;
        const { url, publicId } = await uploadToCloudinary(file, folder);
        uploaded.push({
          url,
          publicId,
          alt: { en: "", gu: "" },
          isPrimary: false,
        });
      }
      const next = [...images, ...uploaded];
      if (!next.some((i) => i.isPrimary) && next.length > 0) {
        next[0].isPrimary = true;
      }
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
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
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={busy || images.length >= max}
        >
          {busy ? "Uploading…" : "+ Upload image"}
        </Button>
        <span className="text-xs text-russet-dark/60">
          {images.length}/{max} · drag to reorder · first image is used on cards
        </span>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-alloy/40 bg-alloy/10 px-3 py-2 text-sm text-russet">
          {error}
        </p>
      )}

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
              className={`overflow-hidden rounded-xl border bg-cornsilk ${
                img.isPrimary ? "border-alloy" : "border-cornsilk-dark"
              }`}
            >
              <div className="relative aspect-[4/3] bg-meringue-light">
                <Image
                  src={cldUrl(img.url, CLD.thumb) ?? img.url}
                  alt={img.alt.en || "Product image"}
                  fill
                  unoptimized
                  className="cursor-move object-cover"
                />
                {img.isPrimary && (
                  <span className="absolute left-2 top-2 rounded-full bg-alloy px-2 py-0.5 text-[10px] font-semibold uppercase text-cornsilk-light">
                    Primary
                  </span>
                )}
              </div>
              <div className="space-y-2 p-2">
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
                  className="w-full rounded border border-camel-light px-2 py-1 text-xs outline-none focus:border-olive"
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
                  className="w-full rounded border border-camel-light px-2 py-1 text-xs outline-none focus:border-olive"
                />
                <div className="flex items-center justify-between">
                  {!img.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => makePrimary(index)}
                      className="text-xs font-semibold text-olive-dark hover:text-alloy-dark"
                    >
                      Make primary
                    </button>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-xs font-semibold text-russet-dark/60 hover:text-alloy-dark"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
