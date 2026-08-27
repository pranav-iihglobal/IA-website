import type { Metadata } from "next";
import { SITE, resolveText, type Bi } from "./content";
import { CLD, cldUrl } from "./images";
import { getDisplayProduct } from "./products-source";
import { getDisplayPost } from "./posts-source";
import { alternatesFor, localePath, type Locale } from "./i18n";
import { OG_IMAGE, ogImages } from "./seo";

/**
 * Metadata for the two dynamic routes, in either language.
 *
 * Each product and article exists at two addresses — /products/floramax and
 * /gu/products/floramax — rendered by the same component. The Gujarati route
 * imports the English page's default export, so the only thing that actually
 * differs between them is the metadata: title and description in the right
 * language, a self-referencing canonical, and hreflang pointing at the twin.
 *
 * These live here rather than in the page files because Next validates the
 * exports of a route file and rejects anything outside its known set — a
 * shared helper exported from page.tsx fails the build.
 */

/** The og:locale pair for a page: the one it is, then the one it is not. */
function ogLocale(locale: Locale) {
  return locale === "gu"
    ? { locale: "gu_IN", alternateLocale: ["en_IN"] }
    : { locale: "en_IN", alternateLocale: ["gu_IN"] };
}

/**
 * Title, description and social title for each fixed page, in both languages.
 *
 * The Gujarati routes render the same components as the English ones, so the
 * page copy takes care of itself — but metadata does not inherit across
 * locales. Without a table like this every /gu page would fall back to the
 * root layout's default title and the whole Gujarati half of the site would
 * compete with itself for one snippet in the results.
 *
 * `title.absolute` on the home page opts out of the "%s | IKSARVA" template,
 * which would otherwise repeat the brand name twice.
 */
interface PageSeo {
  title?: Bi;
  absoluteTitle?: Bi;
  description: Bi;
  ogTitle: Bi;
}

const PAGE_SEO: Record<string, PageSeo> = {
  "/": {
    absoluteTitle: {
      en: `${SITE.shortName} — Biofertilizers from North Gujarat | ${SITE.tagline}`,
      gu: `${SITE.shortName} — ઉત્તર ગુજરાતનાં જૈવિક ખાતર | ${SITE.taglineGu}`,
    },
    description: {
      en: "Biofertilizers made in North Gujarat: mycorrhizal cultures, NPK consortia and biostimulants that work with the microbial life in your field.",
      gu: "મૂળથી મજબૂત, પાક ભરપૂર — ઉત્તર ગુજરાતમાં બનેલાં જૈવિક ખાતર: માયકોરાઇઝા કલ્ચર, NPK બેક્ટેરિયા અને બાયોસ્ટિમ્યુલન્ટ.",
    },
    ogTitle: {
      en: `${SITE.shortName} — Biofertilizers from North Gujarat`,
      gu: `${SITE.shortName} — ઉત્તર ગુજરાતનાં જૈવિક ખાતર`,
    },
  },
  "/products": {
    title: { en: "Products", gu: "પ્રોડક્ટ્સ" },
    description: {
      en: "FloraMax flowering bio-stimulant, Mycorrhizal Bio-Fertilizer, and NPK Consortia Bio-Fertilizer — biofertilizers made for North Gujarat's crops.",
      gu: "ફ્લોરામેક્સ ફ્લાવરિંગ બાયો-સ્ટિમ્યુલન્ટ, માયકોરાઇઝા બાયો-ફર્ટિલાઇઝર અને NPK કન્સોર્શિયા બાયો-ફર્ટિલાઇઝર — ઉત્તર ગુજરાતના પાક માટે બનેલાં જૈવિક ખાતર.",
    },
    ogTitle: {
      en: "IKSARVA Products — Biofertilizers for North Gujarat",
      gu: "IKSARVA પ્રોડક્ટ્સ — ઉત્તર ગુજરાત માટે જૈવિક ખાતર",
    },
  },
  "/about": {
    title: { en: "About", gu: "અમારા વિશે" },
    description: {
      en: "IKSARVA Agritech is a biofertilizer company from North Gujarat helping farmers reduce chemical inputs and rebuild living soil.",
      gu: "IKSARVA એગ્રિટેક ઉત્તર ગુજરાતની જૈવિક ખાતર કંપની છે, જે ખેડૂતોને કેમિકલ ઘટાડવામાં અને જમીનને ફરી જીવંત બનાવવામાં મદદ કરે છે.",
    },
    ogTitle: {
      en: "About IKSARVA Agritech",
      gu: "IKSARVA એગ્રિટેક વિશે",
    },
  },
  "/contact": {
    title: { en: "Contact", gu: "સંપર્ક" },
    description: {
      en: "Reach IKSARVA Agritech on WhatsApp, phone or email. Based in Mehsana, North Gujarat, India.",
      gu: "IKSARVA એગ્રિટેકનો સંપર્ક વોટ્સએપ, ફોન કે ઈમેલ પર કરો. મહેસાણા, ઉત્તર ગુજરાત, ભારત.",
    },
    ogTitle: {
      en: "Contact IKSARVA Agritech",
      gu: "IKSARVA એગ્રિટેકનો સંપર્ક",
    },
  },
  "/dealers": {
    title: { en: "Become a Dealer", gu: "ડીલર બનો" },
    description: {
      en: "Join IKSARVA's growing dealer network in North Gujarat. Good margins, farmer demand and full support for agri-input dealers.",
      gu: "ઉત્તર ગુજરાતમાં IKSARVA ના વધતા ડીલર નેટવર્કમાં જોડાઓ. સારું માર્જિન, ખેડૂતોની માંગ અને એગ્રિ-ઇનપુટ ડીલરો માટે પૂરો સપોર્ટ.",
    },
    ogTitle: {
      en: "Become an IKSARVA Dealer",
      gu: "IKSARVA ડીલર બનો",
    },
  },
  "/testimonials": {
    title: { en: "Testimonials", gu: "ખેડૂતોના અનુભવ" },
    description: {
      en: "What farmers across North Gujarat say about IKSARVA biofertilizers.",
      gu: "ઉત્તર ગુજરાતના ખેડૂતો IKSARVA જૈવિક ખાતર વિશે શું કહે છે.",
    },
    ogTitle: {
      en: "Farmers' experiences | IKSARVA",
      gu: "ખેડૂતોના અનુભવ | IKSARVA",
    },
  },
  "/learn": {
    title: { en: "Learn", gu: "માહિતી" },
    description: {
      en: "Plain-language guides on soil health, mycorrhiza and cutting chemical inputs, from IKSARVA Agritech.",
      gu: "જમીનની તંદુરસ્તી, માયકોરાઇઝા અને કેમિકલ ઘટાડવા વિશે સાદી ભાષામાં માર્ગદર્શન — IKSARVA એગ્રિટેક તરફથી.",
    },
    ogTitle: {
      en: "Knowledge for your field | IKSARVA",
      gu: "તમારા ખેતર માટે માહિતી | IKSARVA",
    },
  },
};

/** Metadata for one of the fixed pages, in one language. */
export function staticPageMetadata(path: string, locale: Locale): Metadata {
  const seo = PAGE_SEO[path];
  if (!seo) throw new Error(`No page SEO entry for ${path}`);

  const description = resolveText(seo.description, locale);

  return {
    title: seo.absoluteTitle
      ? { absolute: resolveText(seo.absoluteTitle, locale) }
      : seo.title
        ? resolveText(seo.title, locale)
        : undefined,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      title: resolveText(seo.ogTitle, locale),
      description,
      url: localePath(path, locale),
      ...ogLocale(locale),
      images: [OG_IMAGE],
    },
  };
}

export async function productMetadata(
  slug: string,
  locale: Locale,
): Promise<Metadata> {
  const product = await getDisplayProduct(slug);
  if (!product) return {};

  const name = resolveText(product.name, locale);
  const category = resolveText(product.categoryLabel, locale);
  const description = resolveText(product.tagline, locale);
  const path = `/products/${product.slug}`;

  return {
    title: `${name} — ${category}`,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      title: `${name} | ${SITE.shortName}`,
      description,
      url: localePath(path, locale),
      ...ogLocale(locale),
      // Its own photos when it has them, the site card when it does not —
      // a product with no pack shot yet still previews as something.
      images: ogImages(
        product.images
          .map((i) => cldUrl(i.url, CLD.productDetail))
          .filter(Boolean)
          .map((url) => ({ url: url as string })),
      ),
    },
  };
}

export async function postMetadata(
  slug: string,
  locale: Locale,
): Promise<Metadata> {
  const article = await getDisplayPost(slug);
  if (!article) return {};

  // Meta fields fall back to the title/excerpt when left blank in the admin.
  const title =
    resolveText(article.metaTitle, locale) ||
    resolveText(article.title, locale);
  const description =
    resolveText(article.metaDescription, locale) ||
    resolveText(article.excerpt, locale);
  const cover = cldUrl(article.coverImage?.url, CLD.blogCover);
  const path = `/learn/${article.slug}`;

  return {
    title,
    description,
    alternates: alternatesFor(path, locale),
    openGraph: {
      type: "article",
      title,
      description,
      url: localePath(path, locale),
      ...ogLocale(locale),
      // The cover when there is one, the site card otherwise.
      images: ogImages(cover ? [{ url: cover }] : null),
    },
  };
}
