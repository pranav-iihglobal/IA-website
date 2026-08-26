"use client";

import { useSlugCheck } from "@/lib/admin/form-hooks";
import { FieldError, Spinner } from "./ui";

/**
 * URL slug input with live availability.
 *
 * The slug carries a unique index, so a clash used to surface only as a 409
 * after the whole form was filled in. This says so while there is still one
 * field to fix.
 */
export function SlugField({
  value,
  onChange,
  type,
  excludeId,
  basePath,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  type: "product" | "post";
  /** The record being edited, so its own slug does not read as taken. */
  excludeId?: string;
  /** Public path prefix shown under the field, e.g. "/products". */
  basePath: string;
  error?: string;
}) {
  const state = useSlugCheck({ type, slug: value, excludeId });
  const taken = state === "taken";

  return (
    <label className="admin-field block">
      <div className="flex items-center justify-between gap-3">
        <span className="admin-label text-sm font-semibold text-russet">
          URL slug<span className="ml-0.5 text-alloy">*</span>
        </span>
        {state === "checking" && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-russet-dark/50">
            <Spinner />
            Checking…
          </span>
        )}
        {state === "available" && (
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-olive-dark">
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z"
                clipRule="evenodd"
              />
            </svg>
            Available
          </span>
        )}
        {taken && (
          <span className="text-[11px] font-semibold text-alloy-dark">
            Already in use
          </span>
        )}
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error || taken ? true : undefined}
        className="admin-input mt-1.5"
      />

      {!error && !taken && (
        <span className="mt-1.5 block text-xs text-russet-dark/55">
          Public URL: {basePath}/{value || "…"}
        </span>
      )}
      <FieldError
        message={
          error ??
          (taken ? "Another item already uses this slug — pick a different one." : undefined)
        }
      />
    </label>
  );
}
