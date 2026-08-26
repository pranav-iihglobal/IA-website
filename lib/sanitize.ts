import sanitizeHtmlLib from "sanitize-html";

/**
 * Sanitize rich-text HTML before it is stored or rendered.
 *
 * The editor is behind admin auth, so this is defence in depth rather than
 * the primary control — but article HTML is rendered with
 * dangerouslySetInnerHTML on public pages, so anything that slipped into the
 * database (a compromised session, a bad paste from another site) must not
 * become script execution for every visitor.
 *
 * Uses sanitize-html (htmlparser2) rather than DOMPurify. DOMPurify needs a
 * DOM, which on the server means jsdom — 600+ files traced into the blog API
 * lambda, and a reliable way to crash a serverless function at module load.
 * This parses HTML directly and pulls in nothing of the sort.
 */

/** Video hosts we deliberately embed. Everything else loses its iframe. */
const ALLOWED_IFRAME_HOSTNAMES = [
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "www.youtube.com",
  "youtube.com",
  "www.instagram.com",
  "instagram.com",
  "www.facebook.com",
  "facebook.com",
];

export function sanitizeHtml(html: string): string {
  if (!html) return "";

  return sanitizeHtmlLib(html, {
    allowedTags: [
      "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
      "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "hr", "figure",
      "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span",
      "iframe",
    ],
    allowedAttributes: {
      "*": ["class", "title"],
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height", "loading"],
      iframe: [
        "src", "width", "height", "allow", "allowfullscreen",
        "frameborder", "loading", "title",
      ],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    // Blocks data: URIs in <img src>, a classic sanitizer bypass route.
    allowedSchemesByTag: { img: ["http", "https"] },
    /**
     * A real host check. The previous DOMPurify config claimed to restrict
     * embeds to known video hosts but only ran a generic URI-shape regex —
     * any https iframe passed. This actually enforces it.
     */
    allowedIframeHostnames: ALLOWED_IFRAME_HOSTNAMES,
    allowProtocolRelative: false,
    transformTags: {
      // Anything opening a new tab must not hand the opener to the target.
      a: (tagName, attribs) => ({
        tagName,
        attribs: attribs.target
          ? { ...attribs, rel: "noopener noreferrer" }
          : attribs,
      }),
    },
  });
}
