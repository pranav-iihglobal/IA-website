import type { Bi } from "@/lib/content";
import { UI, waLink } from "@/lib/content";
import { T } from "@/components/T";

/**
 * Downloadable product documents (brochure, label …).
 *
 * Each row offers two routes to the same file: a direct download for anyone
 * on a decent connection, and a WhatsApp request for farmers who would rather
 * have it land in a chat they can find again.
 */

export interface DownloadItem {
  type: "brochure" | "label" | "leaflet" | "other";
  title: Bi;
  fileUrl: string;
  sizeBytes: number;
}

/** Human file size. Returns "" for 0 so an unknown size renders nothing. */
function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const TYPE_LABEL: Record<DownloadItem["type"], Bi> = {
  brochure: { en: "Brochure", gu: "માહિતી પુસ્તિકા" },
  label: { en: "Label", gu: "લેબલ" },
  leaflet: { en: "Leaflet", gu: "પત્રિકા" },
  other: { en: "Document", gu: "કાગળ" },
};

function DocIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
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
  );
}

export function Downloads({
  items,
  productName,
}: {
  items: DownloadItem[];
  /** English product name, used in the WhatsApp message. */
  productName: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl font-bold text-russet">
        <T text={UI.downloads} />
      </h2>
      <p className="mt-1 text-sm text-olive-dark">
        <T text={UI.downloadsNote} />
      </p>

      <ul className="mt-4 grid gap-3">
        {items.map((item, i) => {
          const size = formatSize(item.sizeBytes);
          return (
            <li
              key={`${item.fileUrl}-${i}`}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-cornsilk-dark bg-cornsilk p-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-meringue text-alloy-dark">
                <DocIcon />
              </span>

              <div className="min-w-[10rem] flex-1">
                <p className="font-semibold text-russet">
                  <T text={item.title} />
                </p>
                <p className="text-xs text-olive-dark">
                  <T text={TYPE_LABEL[item.type]} />
                  {size && ` · ${size}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-alloy px-4 py-2 text-sm font-semibold text-cornsilk-light transition-colors hover:bg-alloy-dark"
                >
                  <T text={UI.download} />
                </a>
                <a
                  href={waLink(
                    `Hello IKSARVA, please send me the "${item.title.en}" for ${productName}.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-olive px-4 py-2 text-sm font-semibold text-olive-dark transition-colors hover:bg-laurel-light/40"
                >
                  <T text={UI.getOnWhatsApp} />
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
