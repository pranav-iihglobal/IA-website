/**
 * Small formatting helpers shared by the public site and the admin panel.
 * Pure functions only — safe on either side of the server/client boundary.
 */

/** Human file size. Returns "" for 0 so an unknown size renders nothing. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Short date for admin rows, e.g. "26 Aug". */
export function formatShortDate(value: string | Date | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
