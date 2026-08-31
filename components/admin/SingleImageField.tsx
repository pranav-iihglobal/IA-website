"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CLD, cldUrl } from "@/lib/images";
import { uploadToCloudinary, type UploadFolder } from "@/lib/admin/upload";
import { useToast } from "./Toast";
import { Spinner } from "./ui";

export interface MediaRef {
  url: string;
  publicId: string;
}

/**
 * Compact single-image slot for use inside repeatable rows (application
 * steps, before/after pairs) where the full ImageUploader drop zone would
 * dwarf the row it belongs to.
 */
export function SingleImageField({
  label,
  value,
  onChange,
  folder = "products",
  error,
}: {
  label: string;
  value: MediaRef;
  onChange: (value: MediaRef) => void;
  folder?: UploadFolder;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("That file is not an image.", "error");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadToCloudinary(file, folder);
      onChange({ url: uploaded.url, publicId: uploaded.publicId });
      toast("Image uploaded");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const thumb = cldUrl(value.url, CLD.thumb);

  return (
    <div className="admin-field">
      <span className="admin-label text-xs font-semibold uppercase tracking-wide text-accent">
        {label}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {thumb ? (
        <div className="group relative mt-1.5 aspect-square overflow-hidden rounded-xl border border-line-soft/70 bg-surface-muted">
          <Image src={thumb} alt="" fill unoptimized className="object-cover" />
          <button
            type="button"
            onClick={() => onChange({ url: "", publicId: "" })}
            aria-label={`Remove ${label}`}
            className="absolute right-1.5 top-1.5 rounded-full bg-raised/90 p-1.5 text-ink-muted opacity-0 shadow-sm transition-opacity hover:text-cta focus-visible:opacity-100 group-hover:opacity-100"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M6.3 5A1 1 0 0 0 5 6.3L8.6 10 5 13.7A1 1 0 1 0 6.3 15L10 11.4l3.7 3.6a1 1 0 0 0 1.3-1.3L11.4 10 15 6.3A1 1 0 0 0 13.7 5L10 8.6 6.3 5Z" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-1.5 flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-center transition-colors ${
            error
              ? "border-alloy bg-alloy/5"
              : "border-line bg-surface-muted/45 hover:border-olive hover:bg-accent-soft/20"
          } ${busy ? "cursor-wait opacity-70" : "cursor-pointer"}`}
        >
          {busy ? (
            <Spinner />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 16V4m0 0L8 8m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          )}
          <span className="text-xs font-semibold text-ink-muted">
            {busy ? "Uploading…" : "Add photo"}
          </span>
        </button>
      )}
    </div>
  );
}
