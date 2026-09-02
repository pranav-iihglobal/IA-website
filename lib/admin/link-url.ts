/**
 * A URL that is safe to put in an href.
 *
 * The rich-text editor asked for a link with `window.prompt` and inserted
 * whatever came back, unchecked. `javascript:alert(1)` was a valid answer —
 * and blog content is PUBLISHED, so that mark ends up in a page served to
 * every visitor. Not a hypothetical: it is one paste away, and the person
 * pasting need not know what they pasted.
 *
 * Returns the URL to use, or null when it cannot be made safe.
 */

/** Everything else — javascript:, data:, vbscript:, file: — is refused. */
const ALLOWED = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeLinkHref(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  /*
    A bare domain is what people actually type. Treated as https rather than
    refused, because refusing "iksarva.com" teaches nobody anything — but only
    when it has no scheme at all, so nothing here can upgrade a scheme that
    was rejected below.
  */
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value)
    // A protocol-relative //host is not a scheme; it inherits the page's.
    || value.startsWith("//")
      ? value
      : `https://${value}`;

  try {
    const url = new URL(candidate, "https://iksarva.com");
    return ALLOWED.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}
