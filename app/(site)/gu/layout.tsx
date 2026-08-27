/**
 * The Gujarati half of the site.
 *
 * Every page under here renders exactly the same component as its unprefixed
 * English twin — the only difference is the language, and that is resolved
 * from the URL by LanguageProvider in the root layout, not supplied here.
 * (It was supplied here at first, which quietly left the header and footer in
 * English: they are rendered by app/(site)/layout.tsx, one segment above.)
 *
 * So all this layout contributes is the lang attribute. It goes on a wrapper
 * rather than <html>, which belongs to the root layout and cannot know the
 * locale. `lang` is valid on any element and scopes to its subtree, so screen
 * readers pick the right voice and crawlers read the right language for the
 * content that matters.
 */
export default function GujaratiLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div lang="gu">{children}</div>;
}
