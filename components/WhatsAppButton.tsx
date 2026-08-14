import type { Bi } from "@/lib/content";
import { waLink } from "@/lib/content";
import { T } from "./T";

function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.18-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.67a8.23 8.23 0 1 1-4.2 15.3l-.3-.18-3.07.89.9-3-.2-.31a8.23 8.23 0 0 1 6.87-12.7Zm-3.1 3.87c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.12.17 1.74 2.79 4.3 3.8 2.13.84 2.56.67 3.02.63.46-.04 1.49-.61 1.7-1.2.21-.58.21-1.09.15-1.19-.06-.1-.23-.17-.48-.29-.25-.13-1.49-.73-1.72-.82-.23-.08-.4-.12-.56.13-.17.25-.65.81-.8.98-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-2-1.23 7.5 7.5 0 0 1-1.4-1.73c-.14-.25 0-.39.11-.51.11-.12.25-.29.38-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.07-.12-.55-1.36-.77-1.86-.2-.48-.4-.42-.56-.43l-.54-.04Z" />
    </svg>
  );
}

/**
 * Primary WhatsApp CTA. `message` is pre-filled into the chat.
 * Server component — the label switches language via the <T> leaf.
 */
export function WhatsAppButton({
  message,
  label,
  variant = "primary",
}: {
  message: string;
  label: Bi;
  variant?: "primary" | "light";
}) {
  const styles =
    variant === "primary"
      ? "bg-alloy text-cornsilk-light hover:bg-alloy-dark"
      : "bg-cornsilk-light text-russet hover:bg-cornsilk";
  return (
    <a
      href={waLink(message)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold shadow-sm transition-colors ${styles}`}
    >
      <WhatsAppIcon className="h-5 w-5" />
      <T text={label} />
    </a>
  );
}
