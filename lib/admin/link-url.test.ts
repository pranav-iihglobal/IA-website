import { describe, expect, it } from "vitest";
import { safeLinkHref } from "./link-url";

describe("safeLinkHref", () => {
  it("keeps ordinary links", () => {
    expect(safeLinkHref("https://iksarva.com/products")).toBe(
      "https://iksarva.com/products",
    );
    expect(safeLinkHref("http://example.org/a?b=1")).toBe("http://example.org/a?b=1");
    expect(safeLinkHref("mailto:hello@iksarva.com")).toBe("mailto:hello@iksarva.com");
    expect(safeLinkHref("tel:+919825012345")).toBe("tel:+919825012345");
  });

  it("assumes https for a bare domain, which is what people type", () => {
    expect(safeLinkHref("iksarva.com")).toBe("https://iksarva.com/");
    expect(safeLinkHref("  www.example.org/x  ")).toBe("https://www.example.org/x");
  });

  it("refuses a script URL", () => {
    // This is the whole reason the file exists: blog content is PUBLISHED.
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
    expect(safeLinkHref("JavaScript:alert(1)")).toBeNull();
    expect(safeLinkHref("  javascript:void(0)  ")).toBeNull();
    expect(safeLinkHref("vbscript:msgbox(1)")).toBeNull();
  });

  it("refuses data: and file:", () => {
    expect(safeLinkHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeLinkHref("file:///etc/passwd")).toBeNull();
  });

  it("does not upgrade a rejected scheme by prefixing https", () => {
    // The bare-domain convenience must not become a way through the filter.
    expect(safeLinkHref("javascript:alert(1)")).toBeNull();
  });

  it("resolves a protocol-relative link rather than treating it as a domain", () => {
    expect(safeLinkHref("//example.org/x")).toBe("https://example.org/x");
  });

  it("is null for nothing at all", () => {
    expect(safeLinkHref("")).toBeNull();
    expect(safeLinkHref("   ")).toBeNull();
  });
});
