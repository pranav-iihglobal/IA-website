import { siFacebook, siInstagram, siWhatsapp } from "simple-icons";
import { SOCIALS } from "@/lib/content";

// Official brand glyphs from simple-icons (24x24 viewBox), resolved at
// build time — this is a server component, so no icon library ships to
// the browser.
const ICON_PATHS: Record<string, string> = {
  instagram: siInstagram.path,
  facebook: siFacebook.path,
  whatsapp: siWhatsapp.path,
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
