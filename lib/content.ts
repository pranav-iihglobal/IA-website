/**
 * ============================================================================
 * IKSARVA — SINGLE SOURCE OF TRUTH for site config, copy, and placeholders.
 * ============================================================================
 *
 * The site is bilingual with GUJARATI AS THE DEFAULT language; visitors can
 * switch to English with the header toggle.
 *
 * Contact details, address and founder names are filled in. Still optional
 * before launch:
 *
 *   1. Founder photos — the About page currently shows illustrated doodles
 *      (components/Illustrations.tsx → FounderDoodle); swap for real
 *      headshots when available.
 *   2. FloraMax pack shot — drop it at public/products/floramax.jpg and it
 *      appears automatically.
 *
 * The Gujarati copy below was drafted in plain, conversational Gujarati
 * (avoiding Sanskritised words) — please review it with a native speaker
 * before launch and edit freely; it lives only in this file and in
 * content/learn/gu/*.md (article translations).
 */

/** A bilingual string. If a `gu` value starts with "[GU:" it is treated as
 *  unfilled and the site falls back to English for that string. */
export interface Bi {
  en: string;
  gu: string;
}

export type Lang = "en" | "gu";

/** Resolve a bilingual string for a language, falling back to English when
 *  the Gujarati value is an unfilled "[GU: …]" placeholder. Pure function —
 *  usable from both server and client components. */
export function resolveText(text: Bi, lang: Lang): string {
  if (lang === "gu" && text.gu && !text.gu.startsWith("[GU:")) {
    return text.gu;
  }
  return text.en;
}

/* ========================================================================== */
/* 1. SITE CONFIG + CONTACT PLACEHOLDERS                                      */
/* ========================================================================== */

export const SITE = {
  name: "IKSARVA Agritech Private Limited",
  shortName: "IKSARVA Agritech",
  url: "https://iksarva.com",
  tagline: "Roots to Riches",
  taglineGu: "મૂળથી મજબૂત, પાક ભરપૂર", // final approved copy

  /** WhatsApp business number: country code + number, digits only. */
  whatsappNumber: "919227000824",

  /** Human-readable phone shown on the contact page and footer. */
  phoneDisplay: "+91 92270 00824",

  /** Registered/operating address. */
  address: {
    street: "01, Patel Rameshbhai Hemtabhai, Vill. Kheradi, At & Po. Kheradi, Ta. Bhiloda",
    city: "Bhiloda",
    district: "Sabarkantha",
    region: "North Gujarat",
    state: "Gujarat",
    postalCode: "383355",
    country: "IN",
  },

  /** Contact email. */
  email: "info@iksarva.com",
} as const;

/**
 * What has to appear on a tax invoice as the SELLER.
 *
 * None of this is secret — every one of these is printed on every invoice and
 * shown to every customer — so it lives here as ordinary content rather than
 * in an environment variable.
 *
 * ⚠️ FILL THESE IN. A tax invoice without the supplier's GSTIN is not a valid
 * tax invoice. The print view refuses to pretend: it shows a visible warning
 * rather than printing a blank line, because a document that looks complete
 * and is not is worse than one that says what is missing.
 */
export const SELLER = {
  /** 15 characters, e.g. 24ABCDE1234F1Z5. */
  gstin: "",
  pan: "",
  /** State code for the place of supply. 24 is Gujarat. */
  stateCode: "24",
  /** Optional, printed under the totals if set. */
  bank: {
    name: "",
    accountNo: "",
    ifsc: "",
  },
} as const;

/** Build a WhatsApp deep link with a pre-filled message. */
export function waLink(message: string): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Social profiles — shown in the footer and on the contact page, and listed
 * in the Organization schema for search engines.
 *
 * ⚠️ The URLs below assume an "iksarva" handle on each platform — UPDATE
 * them to your real profile links. Delete (or comment out) any entry you
 * don't have; only listed entries are rendered.
 */
export const SOCIALS: { name: string; icon: "instagram" | "facebook" | "whatsapp"; href: string }[] = [
  { name: "Instagram", icon: "instagram", href: "https://instagram.com/iksarva" },
  { name: "Facebook", icon: "facebook", href: "https://facebook.com/iksarva" },
  { name: "WhatsApp", icon: "whatsapp", href: `https://wa.me/${SITE.whatsappNumber}` },
];

/* ========================================================================== */
/* 2. NAVIGATION                                                              */
/* ========================================================================== */

export const NAV: { href: string; label: Bi }[] = [
  { href: "/", label: { en: "Home", gu: "હોમ" } },
  { href: "/products", label: { en: "Products", gu: "પ્રોડક્ટ્સ" } },
  { href: "/about", label: { en: "About", gu: "અમારા વિશે" } },
  { href: "/dealers", label: { en: "For Dealers", gu: "ડીલરો માટે" } },
  { href: "/testimonials", label: { en: "Testimonials", gu: "અનુભવો" } },
  { href: "/learn", label: { en: "Learn", gu: "જાણકારી" } },
  { href: "/contact", label: { en: "Contact", gu: "સંપર્ક" } },
];

/**
 * The nav label for a path, in both languages.
 *
 * Breadcrumbs name the same sections the nav does, and used to spell them out
 * as English string literals — which put "Products" in the Gujarati pages'
 * structured data. Reading them from NAV keeps the two in step.
 */
export function navLabel(href: string): Bi {
  return NAV.find((item) => item.href === href)?.label ?? { en: "", gu: "" };
}

/* ========================================================================== */
/* 3. SHARED / UI STRINGS                                                     */
/* ========================================================================== */

/**
 * Blog category labels, in both languages.
 *
 * The category is stored as a slug. Rendering that slug directly put "OTHER"
 * on the public article cards — shared here so the admin dropdown and the
 * public page can never disagree about what a category is called.
 */
export const POST_CATEGORIES: Record<string, Bi> = {
  "soil-health": { en: "Soil health", gu: "જમીનની તંદુરસ્તી" },
  "crop-guides": { en: "Crop guides", gu: "પાક માર્ગદર્શન" },
  "company-news": { en: "Company news", gu: "કંપની સમાચાર" },
  other: { en: "Other", gu: "અન્ય" },
};

/**
 * The label for a category, or null when there is nothing worth showing.
 *
 * "other" is the default every post starts with, so printing it would put the
 * same meaningless word on every article.
 */
export function postCategoryLabel(category: string): Bi | null {
  if (!category || category === "other") return null;
  return POST_CATEGORIES[category] ?? { en: category, gu: category };
}

export const UI = {
  askOnWhatsApp: { en: "Ask on WhatsApp", gu: "વોટ્સએપ પર પૂછો" },
  chatOnWhatsApp: { en: "Chat on WhatsApp", gu: "વોટ્સએપ પર વાત કરો" },
  becomeADealer: { en: "Become a Dealer", gu: "ડીલર બનો" },
  viewAllProducts: { en: "See all products", gu: "બધી પ્રોડક્ટ્સ જુઓ" },
  learnMore: { en: "Learn more", gu: "વધુ જાણો" },
  readArticle: { en: "Read article", gu: "લેખ વાંચો" },
  dosage: { en: "Dosage", gu: "ડોઝ" },
  application: { en: "How to apply", gu: "કેવી રીતે વાપરવું" },
  crops: { en: "Works well with", gu: "કયા પાક માટે" },
  benefits: { en: "Why farmers use it", gu: "ખેડૂતો કેમ વાપરે છે" },
  flagship: { en: "Flagship product", gu: "મુખ્ય પ્રોડક્ટ" },
  backToProducts: { en: "All products", gu: "બધી પ્રોડક્ટ્સ" },

  // Pack sizes, composition and licence details. All three were editable in
  // the admin long before anything rendered them.
  packSizesHeading: { en: "Pack sizes", gu: "પેક સાઇઝ" },
  mrpNote: {
    en: "Prices are maximum retail price, inclusive of taxes. Your dealer may charge less.",
    gu: "કિંમત મહત્તમ છૂટક કિંમત (MRP) છે, કર સહિત. તમારા ડીલર ઓછી કિંમત પણ રાખી શકે.",
  },
  compositionHeading: { en: "What is inside", gu: "અંદર શું છે" },
  fcoLabel: { en: "Regulatory", gu: "નિયમન" },
  fcoCompliant: { en: "FCO compliant", gu: "FCO મુજબ" },
  licenceNo: { en: "Licence no.", gu: "લાઇસન્સ નં." },
  suitableCrops: { en: "Suitable crops", gu: "યોગ્ય પાક" },
  cropStage: { en: "When to apply", gu: "ક્યારે વાપરવું" },
  moreImages: { en: "More photos", gu: "વધુ ફોટા" },
  ratedStars: { en: "Rated {n} out of 5", gu: "5 માંથી {n} રેટિંગ" },
  backToLearn: { en: "All articles", gu: "બધા લેખ" },
  minRead: { en: "min read", gu: "મિનિટનું વાંચન" },
  /** Quiet staff link in the footer bar to the admin panel. */
  backoffice: { en: "Backoffice", gu: "બેકઓફિસ" },

  // ---- product page: downloads, gallery, results, FAQ, related ----
  downloads: { en: "Downloads", gu: "ડાઉનલોડ" },
  downloadsNote: {
    en: "Product documents you can save or ask us to send on WhatsApp.",
    gu: "પ્રોડક્ટના કાગળો — સાચવી લો, અથવા વોટ્સએપ પર મંગાવો.",
  },
  download: { en: "Download", gu: "ડાઉનલોડ કરો" },
  getOnWhatsApp: { en: "Get on WhatsApp", gu: "વોટ્સએપ પર મંગાવો" },
  howToUse: { en: "How to use", gu: "કેવી રીતે વાપરવું" },
  howToUseNote: {
    en: "Step by step, the way farmers do it in the field.",
    gu: "પગલું પગલું — ખેતરમાં ખેડૂતો જે રીતે કરે છે તે રીતે.",
  },
  fieldResults: { en: "Results from the field", gu: "ખેતરમાંથી પરિણામ" },
  fieldResultsNote: {
    en: "Real fields, before and after. Photographs shared by farmers.",
    gu: "સાચાં ખેતર — પહેલાં અને પછી. ખેડૂતોએ મોકલેલા ફોટા.",
  },
  before: { en: "Before", gu: "પહેલાં" },
  after: { en: "After", gu: "પછી" },
  faqHeading: { en: "Common questions", gu: "વારંવાર પુછાતા સવાલ" },
  useTogether: { en: "Use together", gu: "સાથે વાપરો" },
  useTogetherNote: {
    en: "These work well alongside this product.",
    gu: "આ પ્રોડક્ટ સાથે આ પણ સારું કામ કરે છે.",
  },
  relatedProducts: { en: "You may also need", gu: "આ પણ કામ આવશે" },
  farmersSay: { en: "What farmers say", gu: "ખેડૂતો શું કહે છે" },

  // ---- availability ----
  inStock: { en: "Available", gu: "ઉપલબ્ધ છે" },
  outOfStock: { en: "Out of stock", gu: "હાલ સ્ટોકમાં નથી" },
  seasonal: { en: "Seasonal", gu: "સીઝન પ્રમાણે" },
  notifyOnWhatsApp: {
    en: "Notify me on WhatsApp",
    gu: "આવે ત્યારે વોટ્સએપ પર જણાવો",
  },
  footerTagline: {
    en: "Biofertilizers made in North Gujarat, for the soil that has been worked too hard.",
    gu: "ઉત્તર ગુજરાતમાં બનેલાં જૈવિક ખાતર — જે જમીન પાસેથી બહુ કામ લેવાયું છે, તેના માટે.",
  },
} as const;

/* ========================================================================== */
/* 4. HOME PAGE                                                               */
/* ========================================================================== */

export const HOME = {
  heroIntro1: {
    en: "Roots to riches. Built for the soil that has been worked too hard.",
    gu: "મૂળથી મજબૂત, પાક ભરપૂર. થાકેલી જમીન માટે બનાવેલાં જૈવિક ખાતર.",
  },
  heroIntro2: {
    en: "Mycorrhizal cultures, NPK consortia and biostimulants formulated to work with the microbial life already in your field — not against it.",
    gu: "માયકોરાઇઝા કલ્ચર, NPK બેક્ટેરિયા અને બાયોસ્ટિમ્યુલન્ટ — તમારા ખેતરમાં પહેલેથી રહેલા સૂક્ષ્મ જીવો સાથે મળીને કામ કરે છે, તેમની સામે નહીં.",
  },
  heroCtaMessage:
    "Hello IKSARVA, I would like to know more about your biofertilizer products.",
  productsHeading: { en: "Our Products", gu: "અમારી પ્રોડક્ટ્સ" },
  productsSub: {
    en: "Three ways to bring your soil back to life — starting with a 25-gram sachet.",
    gu: "તમારી જમીનને ફરી જીવતી કરવાના ત્રણ રસ્તા — શરૂઆત ફક્ત 25 ગ્રામની કોથળીથી.",
  },
  regionHeading: {
    en: "Working where you farm",
    gu: "જ્યાં તમે ખેતી કરો છો, ત્યાં અમે કામ કરીએ છીએ",
  },
  regionSub: {
    en: "We are a North Gujarat company. Our products are tested in the same soil, water and weather your crops grow in.",
    gu: "અમે ઉત્તર ગુજરાતની કંપની છીએ. અમારી પ્રોડક્ટ્સ એ જ જમીન, પાણી અને હવામાનમાં ચકાસાયેલી છે જ્યાં તમારો પાક ઊગે છે.",
  },
  regions: [
    {
      district: { en: "Banaskantha", gu: "બનાસકાંઠા" },
      focus: { en: "Potato farms", gu: "બટાકાની ખેતી" },
      note: {
        en: "Supporting potato growers with soil biology that improves tuber size and count.",
        gu: "બટાકા ઉગાડતા ખેડૂતોને એવું જમીન-જીવન આપીએ છીએ જેનાથી બટાકાનું કદ અને સંખ્યા બંને વધે.",
      },
    },
    {
      district: { en: "Sabarkantha", gu: "સાબરકાંઠા" },
      focus: { en: "Pomegranate orchards", gu: "દાડમની વાડીઓ" },
      note: {
        en: "Helping orchard owners get stronger flowering and better fruit set.",
        gu: "વાડીના માલિકોને વધુ જોરદાર ફૂલ અને સારું ફળ બેસવામાં મદદ કરીએ છીએ.",
      },
    },
    {
      district: { en: "Mehsana", gu: "મહેસાણા" },
      focus: { en: "Dealer network", gu: "ડીલર નેટવર્ક" },
      note: {
        en: "Our growing dealer network keeps products close to your village.",
        gu: "અમારું વધતું ડીલર નેટવર્ક પ્રોડક્ટ્સને તમારા ગામની નજીક રાખે છે.",
      },
    },
  ],
  missionHeading: {
    en: "Less chemical. More life.",
    gu: "કેમિકલ ઓછું. જીવન વધારે.",
  },
  missionBody: {
    en: "Years of heavy chemical fertilizer and pesticide use have left many fields tired — hard soil, weak roots, rising input costs. Our biofertilizers help you cut back on chemicals step by step, by putting the soil's own microbes back to work. Better crop quality, better yield, and soil that stays fertile for your children.",
    gu: "વર્ષોના ભારે રાસાયણિક ખાતર અને દવાના વપરાશે ઘણાં ખેતરોને થકવી નાખ્યાં છે — કઠણ જમીન, નબળાં મૂળ, વધતો ખર્ચ. અમારાં જૈવિક ખાતર જમીનના પોતાના સૂક્ષ્મ જીવોને ફરી કામે લગાડીને તમને ધીરે ધીરે કેમિકલ ઘટાડવામાં મદદ કરે છે. પાકની ગુણવત્તા સારી, ઉપજ સારી, અને જમીન એવી ફળદ્રુપ કે તમારાં સંતાનોને પણ કામ આવે.",
  },
  dealerStripHeading: {
    en: "Sell IKSARVA in your area",
    gu: "તમારા વિસ્તારમાં IKSARVA વેચો",
  },
  dealerStripBody: {
    en: "We are expanding our dealer network across North Gujarat. Good margins, farmer demand, and full support from our team.",
    gu: "અમે ઉત્તર ગુજરાતમાં અમારું ડીલર નેટવર્ક વધારી રહ્યા છીએ. સારું માર્જિન, ખેડૂતોની માંગ અને અમારી ટીમનો પૂરો સાથ.",
  },
} as const;

/* ========================================================================== */
/* 5. PRODUCTS                                                                */
/* ========================================================================== */

export interface Product {
  slug: string;
  name: string;
  flagship?: boolean;
  category: Bi;
  tagline: Bi;
  description: Bi;
  benefits: Bi[];
  dosage: Bi;
  application: Bi;
  crops: Bi;
  format: Bi;
  compliance?: Bi;
  whatsappMessage: string;
  /** Which placeholder illustration to render (see components/Illustrations.tsx) */
  art: "sachet" | "roots" | "network";
}

export const PRODUCTS: Product[] = [
  {
    slug: "floramax",
    name: "FloraMax",
    flagship: true,
    art: "sachet",
    category: {
      en: "Flowering bio-stimulant",
      gu: "ફૂલ માટેનું બાયોસ્ટિમ્યુલન્ટ",
    },
    tagline: {
      en: "More flowers. Stronger fruit set. One 25g sachet per acre.",
      gu: "વધુ ફૂલ. મજબૂત ફળ. એક એકર માટે ફક્ત 25 ગ્રામની એક કોથળી.",
    },
    description: {
      en: "FloraMax is our flagship flowering bio-stimulant powder. It combines seaweed extract and humic acid to push your crop into strong, uniform flowering — so more flowers turn into fruit, and more fruit reaches harvest. It works with the plant's own growth rhythm, not against it.",
      gu: "FloraMax અમારી મુખ્ય પ્રોડક્ટ છે — ફૂલ માટેનો બાયોસ્ટિમ્યુલન્ટ પાવડર. તેમાં સીવીડ (દરિયાઈ વનસ્પતિ)નો અર્ક અને હ્યુમિક એસિડ ભેગાં છે, જે પાકને જોરદાર અને એકસરખાં ફૂલ લાવવામાં મદદ કરે છે — જેથી વધુ ફૂલમાંથી ફળ બેસે અને વધુ ફળ કાપણી સુધી પહોંચે. તે છોડની પોતાની વૃદ્ધિની રીત સાથે કામ કરે છે, તેની સામે નહીં.",
    },
    benefits: [
      {
        en: "More flowering and better fruit set — fewer dropped flowers",
        gu: "વધુ ફૂલ અને સારું ફળ બેસવું — ફૂલ ખરવાનું ઓછું",
      },
      {
        en: "Seaweed extract feeds the plant natural growth boosters",
        gu: "સીવીડનો અર્ક છોડને કુદરતી શક્તિ આપે છે",
      },
      {
        en: "Humic acid improves nutrient uptake through the roots",
        gu: "હ્યુમિક એસિડ મૂળ દ્વારા પોષણ લેવાની ક્ષમતા વધારે છે",
      },
      {
        en: "Tiny dose, low cost per acre — just 25 grams",
        gu: "નાનો ડોઝ, એકર દીઠ ઓછો ખર્ચ — ફક્ત 25 ગ્રામ",
      },
    ],
    dosage: {
      en: "25g per acre — one sachet. Dissolve in water and apply as a foliar spray at the start of flowering.",
      gu: "એકર દીઠ 25 ગ્રામ — એક કોથળી. પાણીમાં ઓગાળીને ફૂલ આવવાની શરૂઆતે પાન પર છંટકાવ કરો.",
    },
    application: {
      en: "Mix one 25g sachet in 150–200 litres of water. Spray on leaves in the early morning or late evening, when flowering begins. Repeat once after 15–20 days if the flowering period is long.",
      gu: "25 ગ્રામની એક કોથળી 150–200 લિટર પાણીમાં ભેળવો. ફૂલ આવવાની શરૂઆત થાય ત્યારે વહેલી સવારે કે મોડી સાંજે પાન પર છંટકાવ કરો. ફૂલનો સમય લાંબો હોય તો 15–20 દિવસ પછી ફરી એક વાર છાંટો.",
    },
    crops: {
      en: "Pomegranate, cumin, watermelon, musk melon, ashwagandha, castor, cotton, vegetables, and other flowering crops grown across North Gujarat.",
      gu: "દાડમ, જીરું, તરબૂચ, ટેટી, અશ્વગંધા, દિવેલા, કપાસ, શાકભાજી અને ઉત્તર ગુજરાતના બીજા ફૂલ આવતા પાક.",
    },
    format: {
      en: "25g powder sachet",
      gu: "25 ગ્રામ પાવડરની કોથળી",
    },
    compliance: {
      en: "FCO Schedule VI compliant — registered biostimulant category under the S.O. 876(E) gazette amendment.",
      gu: "FCO શેડ્યૂલ VI માન્ય — S.O. 876(E) ગેઝેટ સુધારા હેઠળ બાયોસ્ટિમ્યુલન્ટ કેટેગરીમાં નોંધાયેલ.",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about FloraMax (25g flowering bio-stimulant).",
  },
  {
    slug: "mycorrhizal",
    name: "Mycorrhizal Bio-Fertilizer",
    art: "roots",
    category: {
      en: "Mycorrhizal bio-fertilizer",
      gu: "માયકોરાઇઝા જૈવિક ખાતર",
    },
    tagline: {
      en: "Grow your roots an underground helper network.",
      gu: "તમારાં મૂળ માટે જમીનની અંદરનું મદદગાર જાળું.",
    },
    description: {
      en: "Our Mycorrhizal Bio-Fertilizer puts living mycorrhizae into your soil. Mycorrhizae are friendly fungi that attach to your crop's roots and spread thin threads far into the soil — like extra roots your plant didn't have to grow. They pull in water and nutrients from soil the roots alone could never reach.",
      gu: "અમારું માયકોરાઇઝા જૈવિક ખાતર તમારી જમીનમાં જીવતી માયકોરાઇઝા ઉમેરે છે. માયકોરાઇઝા એ મિત્ર ફૂગ છે જે પાકનાં મૂળ સાથે જોડાઈને જમીનમાં દૂર સુધી ઝીણા તાંતણા ફેલાવે છે — જાણે છોડને ઉગાડ્યા વગર વધારાનાં મૂળ મળી ગયાં. તે એવી જમીનમાંથી પાણી અને પોષણ ખેંચી લાવે છે જ્યાં મૂળ એકલાં ક્યારેય પહોંચી ન શકે.",
    },
    benefits: [
      {
        en: "Extends root reach for water and nutrients, many times over",
        gu: "પાણી અને પોષણ માટે મૂળની પહોંચ અનેકગણી વધારે છે",
      },
      {
        en: "Crops handle dry spells better — a real help in low-rain years",
        gu: "પાક સૂકા દિવસો સારી રીતે સહન કરે છે — ઓછા વરસાદના વર્ષમાં સાચી મદદ",
      },
      {
        en: "Better phosphorus uptake, so applied fertilizer is not wasted",
        gu: "ફોસ્ફરસ સારી રીતે મળે છે, એટલે નાખેલું ખાતર વેડફાતું નથી",
      },
      {
        en: "Builds living soil structure that lasts beyond one season",
        gu: "જીવતી જમીનનું બંધારણ બનાવે છે જે એક સીઝનથી વધુ ટકે છે",
      },
    ],
    dosage: {
      en: "Apply at sowing or transplanting, close to the seed or root zone. Ask us for the right rate for your crop and soil.",
      gu: "વાવણી કે ધરું રોપતી વખતે, બીજ કે મૂળની નજીક આપો. તમારા પાક અને જમીન માટે યોગ્ય માત્રા અમને પૂછો.",
    },
    application: {
      en: "Best applied once, early — at sowing, transplanting, or first irrigation — so the fungi can attach to young roots. Avoid mixing with chemical fungicides in the same application.",
      gu: "એક જ વાર, વહેલા આપવું શ્રેષ્ઠ — વાવણી વખતે, ધરું રોપતી વખતે કે પહેલા પિયતે — જેથી ફૂગ કુમળાં મૂળ સાથે જોડાઈ શકે. એ જ વખતે રાસાયણિક ફૂગનાશક ભેળવવાનું ટાળો.",
    },
    crops: {
      en: "Potato, pomegranate, wheat, maize, vegetables — almost every crop except mustard-family crops, which do not partner with mycorrhizae.",
      gu: "બટાકા, દાડમ, ઘઉં, મકાઈ, શાકભાજી — લગભગ દરેક પાક; ફક્ત રાઈ-કોબી પરિવારના પાક માયકોરાઇઝા સાથે જોડાતા નથી.",
    },
    format: {
      en: "250g canister — 100% organic, water-soluble",
      gu: "250 ગ્રામનો ડબ્બો — 100% ઓર્ગેનિક, પાણીમાં ઓગળે",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about your Mycorrhizal Bio-Fertilizer (250g).",
  },
  {
    slug: "npk-consortia",
    name: "NPK Consortia Bio-Fertilizer",
    art: "network",
    category: {
      en: "Bacterial consortium",
      gu: "બેક્ટેરિયાનું મિશ્રણ",
    },
    tagline: {
      en: "Three teams of bacteria. One job: feed your crop.",
      gu: "બેક્ટેરિયાની ત્રણ ટીમ. કામ એક જ: તમારા પાકને પોષણ આપવું.",
    },
    description: {
      en: "NPK Consortia is a blend of three kinds of helpful bacteria: nitrogen-fixers that pull nitrogen from the air, phosphate-solubilizers that unlock phosphorus stuck in your soil, and potash-mobilizers that free up potassium. Together they supply the same N-P-K your crop needs — from the soil and air, not just from a bag.",
      gu: "NPK Consortia એ ત્રણ પ્રકારના મદદગાર બેક્ટેરિયાનું મિશ્રણ છે: હવામાંથી નાઇટ્રોજન ખેંચનારા, જમીનમાં ફસાયેલો ફોસ્ફરસ છૂટો કરનારા, અને પોટાશ ઉપલબ્ધ કરાવનારા. ત્રણેય મળીને પાકને જોઈતું N-P-K પૂરું પાડે છે — જમીન અને હવામાંથી, ફક્ત થેલીમાંથી નહીં.",
    },
    benefits: [
      {
        en: "Cuts your chemical urea and DAP requirement step by step",
        gu: "યુરિયા અને DAPની જરૂરિયાત ધીરે ધીરે ઘટાડે છે",
      },
      {
        en: "Unlocks phosphorus and potash already locked in your soil",
        gu: "જમીનમાં પહેલેથી ફસાયેલાં ફોસ્ફરસ અને પોટાશ છૂટાં કરે છે",
      },
      {
        en: "Keeps feeding the crop through the season, not in one burst",
        gu: "એક ઝાટકે નહીં, આખી સીઝન પાકને પોષણ આપતું રહે છે",
      },
      {
        en: "Safe for soil life, earthworms and the next crop",
        gu: "જમીનના જીવો, અળસિયાં અને પછીના પાક માટે સલામત",
      },
    ],
    dosage: {
      en: "Apply through seed treatment, soil application with compost, or drip irrigation. Ask us for the right rate for your crop.",
      gu: "બીજ માવજતથી, છાણિયા ખાતર સાથે જમીનમાં, કે ટપક સિંચાઈથી આપી શકાય. તમારા પાક માટે યોગ્ય માત્રા અમને પૂછો.",
    },
    application: {
      en: "Works best applied to moist soil, mixed with well-decomposed farmyard manure or through drip. Keep a gap of a few days between this and any chemical fungicide or bactericide.",
      gu: "ભેજવાળી જમીનમાં, સારી રીતે કોહવાયેલા છાણિયા ખાતર સાથે ભેળવીને કે ટપકથી આપવાથી શ્રેષ્ઠ કામ કરે છે. આની અને કોઈપણ રાસાયણિક ફૂગનાશક કે જંતુનાશક વચ્ચે થોડા દિવસનું અંતર રાખો.",
    },
    crops: {
      en: "Potato, wheat, cumin, castor, cotton, ashwagandha, watermelon, musk melon, vegetables — all major crops of Banaskantha, Sabarkantha and Mehsana.",
      gu: "બટાકા, ઘઉં, જીરું, દિવેલા, કપાસ, અશ્વગંધા, તરબૂચ, ટેટી, શાકભાજી — બનાસકાંઠા, સાબરકાંઠા અને મહેસાણાના બધા મુખ્ય પાક.",
    },
    format: {
      en: "500g canister — 100% organic, water-soluble",
      gu: "500 ગ્રામનો ડબ્બો — 100% ઓર્ગેનિક, પાણીમાં ઓગળે",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about your NPK Consortia Bio-Fertilizer (500g).",
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

/* ========================================================================== */
/* 6. ABOUT PAGE                                                              */
/* ========================================================================== */

export const ABOUT = {
  heading: { en: "About IKSARVA", gu: "IKSARVA વિશે" },
  missionHeading: { en: "Our mission", gu: "અમારું ધ્યેય" },
  missionBody1: {
    en: "IKSARVA Agritech was started with one belief: the soil of North Gujarat has been worked too hard, and it deserves better than more chemicals. Every season of heavy urea, DAP and pesticide use pushes yields up for a year — and pushes soil health down for a decade.",
    gu: "IKSARVA Agritech એક વિશ્વાસ સાથે શરૂ થઈ: ઉત્તર ગુજરાતની જમીન પાસેથી બહુ કામ લેવાયું છે, અને હવે તેને વધુ કેમિકલ નહીં, કંઈક સારું જોઈએ. ભારે યુરિયા, DAP અને દવાની દરેક સીઝન એક વર્ષ પૂરતી ઉપજ વધારે છે — અને દસ વર્ષ માટે જમીનની તંદુરસ્તી ઘટાડે છે.",
  },
  missionBody2: {
    en: "We make biofertilizers — mycorrhizal cultures, bacterial consortia and biostimulants — that work with the microbial life already in your field, not against it. Our goal is simple: help farmers reduce their dependence on toxic chemical inputs, improve crop quality and quantity, and hand the next generation soil that is alive.",
    gu: "અમે જૈવિક ખાતર બનાવીએ છીએ — માયકોરાઇઝા કલ્ચર, બેક્ટેરિયાનાં મિશ્રણ અને બાયોસ્ટિમ્યુલન્ટ — જે તમારા ખેતરમાં પહેલેથી રહેલા સૂક્ષ્મ જીવો સાથે કામ કરે છે, તેમની સામે નહીં. અમારું લક્ષ્ય સાદું છે: ખેડૂતોને ઝેરી રાસાયણિક ઇનપુટ પરનો આધાર ઘટાડવામાં મદદ કરવી, પાકની ગુણવત્તા અને ઉપજ વધારવી, અને આવતી પેઢીના હાથમાં જીવતી જમીન સોંપવી.",
  },
  philosophyHeading: {
    en: "Our soil-health philosophy",
    gu: "જમીનની તંદુરસ્તી વિશે અમારી સમજ",
  },
  philosophyBody: {
    en: "A handful of healthy soil holds more living organisms than there are people on Earth. Those microbes already know how to feed your crop — fix nitrogen, unlock phosphorus, extend roots, fight disease. Chemicals silence them; biology wakes them up. We don't ask farmers to change everything overnight. Start with one product, one field, one season — and watch the difference.",
    gu: "તંદુરસ્ત જમીનની એક મુઠ્ઠીમાં પૃથ્વી પરના માણસો કરતાં વધુ જીવો હોય છે. એ સૂક્ષ્મ જીવોને તમારા પાકને પોષવાનું પહેલેથી આવડે છે — નાઇટ્રોજન બાંધવો, ફોસ્ફરસ છૂટો કરવો, મૂળ લંબાવવાં, રોગ સામે લડવું. કેમિકલ તેમને ચૂપ કરી દે છે; જીવવિજ્ઞાન તેમને જગાડે છે. અમે ખેડૂતોને રાતોરાત બધું બદલવાનું નથી કહેતા. એક પ્રોડક્ટ, એક ખેતર, એક સીઝનથી શરૂ કરો — અને ફરક જાતે જુઓ.",
  },
  teamHeading: { en: "The team", gu: "અમારી ટીમ" },
  founders: [
    {
      name: "Arpit Chaudhary",
      doodle: "agri" as const,
      role: {
        en: "Co-founder — Agri Science & Field Operations",
        gu: "સહ-સ્થાપક — કૃષિ વિજ્ઞાન અને ફિલ્ડ કામગીરી",
      },
      bio: {
        en: "Leads product formulation, field trials and farmer training across Banaskantha, Sabarkantha and Mehsana.",
        gu: "પ્રોડક્ટ ફોર્મ્યુલેશન, ખેતર પરનાં પરીક્ષણો અને બનાસકાંઠા, સાબરકાંઠા તથા મહેસાણામાં ખેડૂત તાલીમનું નેતૃત્વ કરે છે.",
      },
    },
    {
      name: "Pranav Joshi",
      doodle: "tech" as const,
      role: {
        en: "Co-founder — Technology & Marketing",
        gu: "સહ-સ્થાપક — ટેક્નોલોજી અને માર્કેટિંગ",
      },
      bio: {
        en: "Leads technology, dealer partnerships and getting IKSARVA products into farmers' hands.",
        gu: "ટેક્નોલોજી, ડીલર ભાગીદારી અને IKSARVA પ્રોડક્ટ્સ ખેડૂતો સુધી પહોંચાડવાનું નેતૃત્વ કરે છે.",
      },
    },
  ],
  regionHeading: {
    en: "Rooted in North Gujarat",
    gu: "ઉત્તર ગુજરાતમાં અમારાં મૂળ",
  },
  regionBody: {
    en: "We work where we live: the potato belts of Banaskantha, the pomegranate orchards of Sabarkantha, and a growing dealer network centred on Mehsana. When we recommend a dose, it is because we have seen it work in this soil, in this water, in this heat.",
    gu: "અમે જ્યાં રહીએ છીએ ત્યાં જ કામ કરીએ છીએ: બનાસકાંઠાનો બટાકાનો પટ્ટો, સાબરકાંઠાની દાડમની વાડીઓ અને મહેસાણા કેન્દ્રમાં રાખીને વધતું ડીલર નેટવર્ક. અમે કોઈ ડોઝ સૂચવીએ, તો એટલા માટે કે અમે તેને આ જ જમીન, આ જ પાણી અને આ જ ગરમીમાં કામ કરતો જોયો છે.",
  },
} as const;

/* ========================================================================== */
/* 7. DEALERS PAGE                                                            */
/* ========================================================================== */

export const DEALERS = {
  heading: {
    en: "Become an IKSARVA dealer",
    gu: "IKSARVAના ડીલર બનો",
  },
  intro: {
    en: "Farmers are asking for alternatives to costly chemicals. Stock the products they are asking for — with good margins and a team that supports you.",
    gu: "ખેડૂતો મોંઘાં કેમિકલના વિકલ્પ માંગી રહ્યા છે. જે પ્રોડક્ટ્સની માંગ છે તે તમારી દુકાનમાં રાખો — સારા માર્જિન અને સાથ આપતી ટીમ સાથે.",
  },
  points: [
    {
      title: { en: "Growing demand", gu: "વધતી માંગ" },
      body: {
        en: "Input costs are rising and farmers are actively looking for biofertilizers that work. You sell what the market is already asking for.",
        gu: "ઇનપુટનો ખર્ચ વધી રહ્યો છે અને ખેડૂતો કામ કરે એવાં જૈવિક ખાતર શોધી રહ્યા છે. બજારમાં જેની માંગ પહેલેથી છે, એ જ તમે વેચો છો.",
      },
    },
    {
      title: { en: "Healthy margins", gu: "સારું માર્જિન" },
      body: {
        en: "Dealer-first pricing with clear, honest terms. Small pack sizes like the 25g FloraMax sachet mean easy stocking and fast turnover.",
        gu: "ડીલરને પ્રથમ રાખતા ભાવ, સ્પષ્ટ અને પ્રમાણિક શરતો. FloraMaxની 25 ગ્રામની કોથળી જેવાં નાનાં પેક એટલે સહેલો સ્ટોક અને ઝડપી વેચાણ.",
      },
    },
    {
      title: { en: "Real support", gu: "સાચો સાથ" },
      body: {
        en: "Product training, farmer demos in your area, and marketing material in Gujarati. We help you build trust with your customers.",
        gu: "પ્રોડક્ટની તાલીમ, તમારા વિસ્તારમાં ખેડૂત ડેમો અને ગુજરાતીમાં માર્કેટિંગ સામગ્રી. તમારા ગ્રાહકોનો વિશ્વાસ જીતવામાં અમે મદદ કરીએ છીએ.",
      },
    },
    {
      title: { en: "Compliant products", gu: "માન્યતાવાળી પ્રોડક્ટ્સ" },
      body: {
        en: "FloraMax is FCO Schedule VI compliant. Sell with confidence — the paperwork is in order.",
        gu: "FloraMax FCO શેડ્યૂલ VI માન્ય છે. વિશ્વાસથી વેચો — બધાં કાગળિયાં બરાબર છે.",
      },
    },
  ],
  ctaHeading: {
    en: "Interested? Talk to us today.",
    gu: "રસ છે? આજે જ વાત કરો.",
  },
  ctaBody: {
    en: "Send us a message on WhatsApp with your name, shop name and taluka. We will get back within one working day.",
    gu: "તમારું નામ, દુકાનનું નામ અને તાલુકો લખીને વોટ્સએપ પર મેસેજ કરો. એક કામકાજના દિવસમાં જવાબ આપીશું.",
  },
  whatsappMessage:
    "Hello IKSARVA, I am interested in becoming a dealer. My name / shop / taluka: ",
} as const;

/* ========================================================================== */
/* 8. LEARN PAGE                                                              */
/* ========================================================================== */

export const LEARN = {
  heading: {
    en: "Knowledge for your field",
    gu: "તમારા ખેતર માટે જાણકારી",
  },
  intro: {
    en: "Plain-language guides on soil health, soil biology, and how to cut chemical inputs without cutting your yield.",
    gu: "જમીનની તંદુરસ્તી, જમીનના જીવો અને ઉપજ ઘટાડ્યા વિના કેમિકલ ઘટાડવા વિશે સાદી ભાષામાં માર્ગદર્શન.",
  },
} as const;

/* ========================================================================== */
/* 8b. TESTIMONIALS PAGE                                                      */
/* ========================================================================== */

export interface Testimonial {
  /** Farmer's name as it should appear. */
  name: string;
  place: Bi;
  crop: Bi;
  /** Which product they used (shown as a chip). */
  product: string;
  quote: Bi;
  /**
   * URL of the PUBLIC Facebook post to embed (e.g.
   * "https://www.facebook.com/iksarva/posts/pfbid..."). When set, the page
   * shows Facebook's official post card instead of the plain quote card.
   * Only public posts can be embedded.
   */
  fbPostUrl?: string;
  /** Leave true on demo entries; remove when you paste a real story. */
  sample?: boolean;
}

/**
 * ⚠️ SAMPLE DATA — the entries below are demo placeholders and each card
 * shows a visible "Sample" tag until you replace them. To show your real
 * Facebook testimonials: copy a post's URL (Share → Copy link) into
 * `fbPostUrl`, put the farmer's name/place/words in, and delete
 * `sample: true`.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "રમેશભાઈ પટેલ",
    place: { en: "Deesa, Banaskantha", gu: "ડીસા, બનાસકાંઠા" },
    crop: { en: "Potato", gu: "બટાકા" },
    product: "NPK Consortia Bio-Fertilizer",
    quote: {
      en: "This season I used one bag of urea less per acre, and the potato size is better than last year. The soil feels softer too.",
      gu: "આ સીઝનમાં એકર દીઠ યુરિયાની એક થેલી ઓછી વાપરી, અને બટાકાનું કદ ગયા વર્ષ કરતાં સારું છે. જમીન પણ પોચી લાગે છે.",
    },
    sample: true,
  },
  {
    name: "ભરતભાઈ ચૌધરી",
    place: { en: "Idar, Sabarkantha", gu: "ઈડર, સાબરકાંઠા" },
    crop: { en: "Pomegranate", gu: "દાડમ" },
    product: "FloraMax",
    quote: {
      en: "After the FloraMax spray the flowering was strong and even. Fruit set is clearly better this year.",
      gu: "FloraMaxનો છંટકાવ કર્યા પછી ફૂલ જોરદાર અને એકસરખાં આવ્યાં. આ વર્ષે ફળ બેસવાનું સ્પષ્ટ સારું છે.",
    },
    sample: true,
  },
  {
    name: "કનુભાઈ દેસાઈ",
    place: { en: "Unjha, Mehsana", gu: "ઊંઝા, મહેસાણા" },
    crop: { en: "Cumin", gu: "જીરું" },
    product: "Mycorrhizal Bio-Fertilizer",
    quote: {
      en: "In the dry spell my neighbour's field wilted before mine. The roots are holding the moisture better.",
      gu: "સૂકા દિવસોમાં પડોશીનું ખેતર મારા કરતાં પહેલાં કરમાયું. મૂળ ભેજ સારી રીતે પકડી રાખે છે.",
    },
    sample: true,
  },
];

export const TESTIMONIALS_PAGE = {
  heading: { en: "Farmers' experiences", gu: "ખેડૂતોના અનુભવ" },
  intro: {
    en: "Real results from real fields — in farmers' own words, straight from our Facebook page.",
    gu: "સાચાં ખેતરોના સાચા પરિણામ — ખેડૂતોના પોતાના શબ્દોમાં, સીધા અમારા ફેસબુક પેજ પરથી.",
  },
  sampleTag: { en: "Sample — real story coming", gu: "નમૂનો — સાચી વાત ટૂંક સમયમાં" },
  fbHeading: { en: "More on our Facebook page", gu: "અમારા ફેસબુક પેજ પર વધુ" },
  fbNote: {
    en: "Follow us on Facebook for field photos, demos and farmer stories.",
    gu: "ખેતરના ફોટા, ડેમો અને ખેડૂતોની વાતો માટે અમને ફેસબુક પર ફોલો કરો.",
  },
  shareHeading: {
    en: "Used our products? Tell us what changed.",
    gu: "અમારી પ્રોડક્ટ વાપરી છે? શું ફરક પડ્યો તે અમને જણાવો.",
  },
  shareBody: {
    en: "Send your experience and field photos on WhatsApp — with your permission we will share it here and on Facebook.",
    gu: "તમારો અનુભવ અને ખેતરના ફોટા વોટ્સએપ પર મોકલો — તમારી રજા લઈને અમે તેને અહીં અને ફેસબુક પર મૂકીશું.",
  },
  shareWhatsappMessage:
    "Hello IKSARVA, I used your product and want to share my experience.",

  /**
   * Prefilled template for the "share your result" deep link.
   *
   * WhatsApp is the intake channel — there is no public form and no public
   * write access to the database. An admin reads the chat and creates the
   * testimonial with source = whatsapp_submission.
   *
   * The blanks are what we need to publish a story, in the order a farmer
   * would naturally fill them in.
   */
  shareTemplate: {
    gu: `નમસ્તે IKSARVA, મારો અનુભવ શેર કરવો છે.

નામ:
ગામ / જિલ્લો:
પાક:
કઈ પ્રોડક્ટ વાપરી:
શું ફરક પડ્યો:

(ખેતરનો ફોટો પણ મોકલી શકો છો)`,
    en: `Hello IKSARVA, I would like to share my experience.

Name:
Village / District:
Crop:
Product used:
What changed:

(You can send a field photo too)`,
  },
  shareCtaLabel: {
    en: "Share your result",
    gu: "તમારો અનુભવ શેર કરો",
  },

  // ---- filters -------------------------------------------------------------
  filterDistrict: { en: "District", gu: "જિલ્લો" },
  filterCrop: { en: "Crop", gu: "પાક" },
  filterProduct: { en: "Product", gu: "પ્રોડક્ટ" },
  filterAll: { en: "All", gu: "બધા" },
  clearFilters: { en: "Clear filters", gu: "ફિલ્ટર હટાવો" },
  noMatches: {
    en: "No stories match these filters yet.",
    gu: "આ ફિલ્ટર પ્રમાણે હજી કોઈ વાત નથી.",
  },
  noMatchesHint: {
    en: "Clear the filters to see every farmer's experience.",
    gu: "બધા ખેડૂતોના અનુભવ જોવા માટે ફિલ્ટર હટાવો.",
  },
  countOne: { en: "story", gu: "અનુભવ" },
  countMany: { en: "stories", gu: "અનુભવ" },

  // ---- verified mark -------------------------------------------------------
  verified: { en: "Verified", gu: "ચકાસેલ" },
  verifiedWhatsapp: { en: "Verified on WhatsApp", gu: "વોટ્સએપ પર ચકાસેલ" },
  verifiedFieldVisit: { en: "Verified by field visit", gu: "ખેતરે જઈને ચકાસેલ" },
  verifiedPhoto: { en: "Verified by photo", gu: "ફોટા દ્વારા ચકાસેલ" },
} as const;

/**
 * "Farmers in <district> say…" — built here so the district heading reads
 * naturally in both languages instead of being glued together at the callsite.
 */
export function districtHeading(district: string, lang: Lang): string {
  if (!district) {
    return lang === "gu" ? "ખેડૂતો શું કહે છે" : "What farmers say";
  }
  return lang === "gu"
    ? `${district}ના ખેડૂતો કહે છે…`
    : `Farmers in ${district} say…`;
}

/* ========================================================================== */
/* 9. CONTACT PAGE                                                            */
/* ========================================================================== */

export const CONTACT = {
  heading: { en: "Talk to us", gu: "અમારી સાથે વાત કરો" },
  intro: {
    en: "WhatsApp is the fastest way to reach us — for product questions, dosages, dealer inquiries, or anything about your field.",
    gu: "અમારા સુધી પહોંચવાનો સૌથી ઝડપી રસ્તો વોટ્સએપ છે — પ્રોડક્ટ, ડોઝ, ડીલરશિપ કે તમારા ખેતર વિશે કંઈ પણ પૂછો.",
  },
  whatsappMessage: "Hello IKSARVA, I have a question.",
  phoneLabel: { en: "Phone", gu: "ફોન" },
  emailLabel: { en: "Email", gu: "ઈમેલ" },
  locationLabel: { en: "Location", gu: "સ્થળ" },
  locationValue: {
    en: "01, Patel Rameshbhai Hemtabhai, Vill. Kheradi, At & Po. Kheradi, Ta. Bhiloda, Sabarkantha, Gujarat — 383355",
    gu: "01, પટેલ રમેશભાઈ હેમતાભાઈ, મુ.પો. ખેરડી, તા. ભીલોડા, જિ. સાબરકાંઠા, ગુજરાત — 383355",
  },
  hoursNote: {
    en: "We reply on WhatsApp between 9 AM and 7 PM, Monday to Saturday.",
    gu: "સોમવારથી શનિવાર, સવારે 9 થી સાંજે 7 સુધી અમે વોટ્સએપ પર જવાબ આપીએ છીએ.",
  },
} as const;

/* ========================================================================== */
/* 10. MISC SHARED STRINGS                                                    */
/* ========================================================================== */

export const MISC = {
  productCta: {
    en: "Have a question about dose, crop, or price? Message us — we reply in Gujarati, Hindi or English.",
    gu: "ડોઝ, પાક કે ભાવ વિશે પ્રશ્ન છે? અમને મેસેજ કરો — અમે ગુજરાતી, હિન્દી કે અંગ્રેજીમાં જવાબ આપીએ છીએ.",
  },
  learnCta: {
    en: "Questions about your field? Ask us directly.",
    gu: "તમારા ખેતર વિશે પ્રશ્નો છે? સીધા અમને પૂછો.",
  },
  notFoundTitle: {
    en: "This page doesn't exist.",
    gu: "આ પાનું અસ્તિત્વમાં નથી.",
  },
  backToHome: { en: "Back to home", gu: "હોમ પર પાછા જાઓ" },
} as const;
