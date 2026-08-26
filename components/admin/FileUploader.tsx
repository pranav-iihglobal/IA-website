"use client";

import { useRef, useState } from "react";
import type { Bi } from "@/lib/content";
import { uploadToCloudinary, type UploadFolder } from "@/lib/admin/upload";
import { formatBytes } from "@/lib/format";
import { useToast } from "./Toast";
import { BiField, SelectField, Spinner } from "./ui";

/**
 * Downloadable document uploader (brochures, labels, leaflets).
 *
 * PDFs go to Cloudinary as `raw` resources, which is a different endpoint and
 * a different delete call from images — `resourceType` travels with each
 * asset so deletion can get it right later.
 */

export interface AdminAsset {
  type: "brochure" | "label" | "leaflet" | "other";
  title: Bi;
  fileUrl: string;
  publicId: string;
  resourceType: "raw" | "image";
  sizeBytes: number;
}

const ACCEPT = ".pdf,application/pdf";
const MAX_MB = 10;

export function FileUploader({
  assets,
  onChange,
  folder = "products",
  max = 6,
  errors = {},
  errorPrefix = "assets",
}: {
  assets: AdminAsset[];
  onChange: (assets: AdminAsset[]) => void;
  folder?: UploadFolder;
  max?: number;
  /** Server-side field errors, keyed "assets.0.title.en" and so on. */
  errors?: Record<string, string>;
  errorPrefix?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const full = assets.length >= max;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const room = Math.max(0, max - assets.length);
    const chosen = Array.from(files).slice(0, room);

    setBusy(true);
    const uploaded: AdminAsset[] = [];
    try {
      for (const file of chosen) {
        if (file.type !== "application/pdf") {
          toast(`${file.name} is not a PDF — skipped.`, "error");
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          toast(`${file.name} is larger than ${MAX_MB} MB — skipped.`, "error");
          continue;
        }
        const result = await uploadToCloudinary(file, folder, "raw");
        uploaded.push({
          type: "brochure",
          // Seed the title from the filename so the row is never nameless.
          title: { en: file.name.replace(/\.pdf$/i, ""), gu: "" },
          fileUrl: result.url,
          publicId: result.publicId,
          resourceType: "raw",
          sizeBytes: result.bytes,
        });
      }
      if (uploaded.length > 0) {
        toast(`${uploaded.length} file${uploaded.length === 1 ? "" : "s"} uploaded`);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      if (uploaded.length > 0) onChange([...assets, ...uploaded]);
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function update(index: number, patch: Partial<AdminAsset>) {
    onChange(assets.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <button
        type="button"
        onClick={() => !full && inputRef.current?.click()}
        disabled={busy || full}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!full && !busy) handleFiles(e.dataTransfer.files);
        }}
        className={`flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-camel bg-meringue-light/45 px-6 py-7 text-center transition-colors hover:border-olive hover:bg-laurel-light/20 ${
          full || busy ? "cursor-not-allowed opacity-70" : "cursor-pointer"
        }`}
      >
        {busy ? (
          <>
            <Spinner />
            <span className="text-sm font-semibold text-russet">Uploading…</span>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="h-7 w-7 text-olive"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 0v5h5" />
              <path d="M9 13h6M9 17h4" />
            </svg>
            <span className="text-sm font-semibold text-russet">
              {full ? `Limit of ${max} files reached` : "Click or drop a PDF here"}
            </span>
            <span className="text-xs text-russet-dark/55">
              {assets.length}/{max} uploaded · PDF only · up to {MAX_MB} MB
            </span>
          </>
        )}
      </button>

      {assets.length > 0 && (
        <ul className="mt-4 space-y-3">
          {assets.map((asset, index) => (
            <li
              key={asset.publicId || asset.fileUrl}
              className="rounded-xl border border-camel-light/60 bg-meringue-light/35 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <a
                  href={asset.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-olive-dark hover:underline"
                >
                  Open file{asset.sizeBytes ? ` · ${formatBytes(asset.sizeBytes)}` : ""}
                </a>
                <button
                  type="button"
                  onClick={() => onChange(assets.filter((_, i) => i !== index))}
                  aria-label="Remove file"
                  className="rounded-lg p-1.5 text-russet-dark/40 transition-colors hover:bg-alloy/10 hover:text-alloy-dark"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                    <path d="M8 2h4a1 1 0 0 1 1 1v1h3a1 1 0 1 1 0 2h-.4l-.7 9.1A2 2 0 0 1 12.9 17H7.1a2 2 0 0 1-2-1.9L4.4 6H4a1 1 0 0 1 0-2h3V3a1 1 0 0 1 1-1Zm1 2h2V4H9Zm-2.6 2 .7 8.9a.5.5 0 0 0 .5.4h5.8a.5.5 0 0 0 .5-.4l.7-8.9H6.4Z" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <BiField
                  label="Title shown on the site"
                  value={asset.title}
                  onChange={(title) => update(index, { title })}
                  errors={{
                    en: errors[`${errorPrefix}.${index}.title.en`],
                  }}
                  required
                />
                <SelectField
                  label="Document type"
                  value={asset.type}
                  onChange={(type) =>
                    update(index, { type: type as AdminAsset["type"] })
                  }
                  options={[
                    { value: "brochure", label: "Brochure" },
                    { value: "label", label: "Label" },
                    { value: "leaflet", label: "Leaflet" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
