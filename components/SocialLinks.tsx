import { SOCIALS } from "@/lib/content";

const ICON_PATHS: Record<string, string> = {
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.8s0 3.6-.1 4.8c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.8s0-3.6.1-4.8c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1Zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.9.3-.5.2-.8.4-1.1.7-.3.3-.6.6-.7 1.1-.1.4-.3.8-.3 1.9-.1 1.2-.1 1.6-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.9.2.5.4.8.7 1.1.3.3.6.6 1.1.7.4.1.8.3 1.9.3 1.2.1 1.6.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.9-.3.5-.2.8-.4 1.1-.7.3-.3.6-.6.7-1.1.1-.4.3-.8.3-1.9.1-1.2.1-1.6.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.9-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.6-1.1-.7-.4-.1-.8-.3-1.9-.3-1.2-.1-1.6-.1-4.8-.1Zm0 3.1a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.2-3a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z",
  facebook:
    "M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.6v3H11v7h2.5Z",
  whatsapp:
    "M12.04 2a9.9 9.9 0 0 0-8.5 14.96L2 22l5.18-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.67a8.23 8.23 0 1 1-4.2 15.3l-.3-.18-3.07.89.9-3-.2-.31a8.23 8.23 0 0 1 6.87-12.7Zm-3.1 3.87c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.23.9 2.42 1.03 2.59.12.17 1.74 2.79 4.3 3.8 2.13.84 2.56.67 3.02.63.46-.04 1.49-.61 1.7-1.2.21-.58.21-1.09.15-1.19-.06-.1-.23-.17-.48-.29-.25-.13-1.49-.73-1.72-.82-.23-.08-.4-.12-.56.13-.17.25-.65.81-.8.98-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-2-1.23 7.5 7.5 0 0 1-1.4-1.73c-.14-.25 0-.39.11-.51.11-.12.25-.29.38-.44.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.44-.07-.12-.55-1.36-.77-1.86-.2-.48-.4-.42-.56-.43l-.54-.04Z",
};

/**
 * Social profile icon row. `tone` matches the surface it sits on:
 * "dark" for the russet footer, "light" for cream pages.
 */
export function SocialLinks({ tone = "dark" }: { tone?: "dark" | "light" }) {
  if (SOCIALS.length === 0) return null;
  const styles =
    tone === "dark"
      ? "border-cornsilk/25 text-cornsilk/90 hover:border-camel-light hover:bg-russet hover:text-cornsilk-light"
      : "border-camel-light bg-cornsilk-light text-olive-dark hover:border-alloy hover:text-alloy-dark";
  return (
    <ul className="flex flex-wrap items-center gap-3">
      {SOCIALS.map((s) => (
        <li key={s.name}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`IKSARVA on ${s.name}`}
            title={s.name}
            className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-200 hover:-translate-y-0.5 ${styles}`}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
              <path d={ICON_PATHS[s.icon]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
