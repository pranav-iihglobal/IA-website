import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize rich-text HTML before it is stored or rendered.
 *
 * The editor is behind admin auth, so this is defence in depth rather than
 * the primary control — but article HTML is rendered with
 * dangerouslySetInnerHTML on public pages, so anything that slipped into the
 * database (a compromised session, a bad paste from another site) must not
 * become script execution for every visitor.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "blockquote", "code", "pre",
      "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "hr", "figure",
      "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span",
      "iframe",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "title", "width", "height",
      "class", "allow", "allowfullscreen", "frameborder", "loading",
    ],
    // Only allow iframes from video hosts we intentionally embed.
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ["target"],
  });
}
