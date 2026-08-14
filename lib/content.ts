/**
 * ============================================================================
 * IKSARVA — SINGLE SOURCE OF TRUTH for site config, copy, and placeholders.
 * ============================================================================
 *
 * EVERYTHING you need to fill in before launch lives in this file:
 *
 *   1. SITE.whatsappNumber  — replace "919999999999" with the real number
 *                             (country code + number, digits only, no "+")
 *   2. SITE.phoneDisplay    — human-readable phone for the contact page
 *   3. SITE.address         — registered office / operating address
 *   4. SITE.email           — contact email
 *   5. Gujarati translations — every string marked "[GU: …]" is a placeholder.
 *      Replace the whole string (including brackets) with real Gujarati copy.
 *      Until replaced, the site automatically falls back to English when the
 *      visitor switches to ગુજરાતી, so unfinished translations never show.
 *   6. Photos — components/Illustrations.tsx holds SVG placeholders; each is
 *      marked with a "PLACEHOLDER" comment for later replacement.
 *
 * The Gujarati tagline (મૂળથી મજબૂત, પાક ભરપૂર) is final approved copy — keep it.
 */

/** A bilingual string. `gu` values starting with "[GU:" are unfilled placeholders. */
export interface Bi {
  en: string;
  gu: string;
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

  /** PLACEHOLDER — replace with the real WhatsApp business number.
   *  Format: country code + number, digits only (e.g. "9198XXXXXXXX"). */
  whatsappNumber: "919999999999",

  /** PLACEHOLDER — human-readable phone shown on the contact page. */
  phoneDisplay: "+91 99999 99999",

  /** PLACEHOLDER — replace with the registered/operating address. */
  address: {
    street: "[Street address / plot number]",
    city: "Mehsana",
    region: "North Gujarat",
    state: "Gujarat",
    postalCode: "[PIN code]",
    country: "IN",
  },

  /** PLACEHOLDER — contact email. */
  email: "contact@iksarva.com",
} as const;

/** Build a WhatsApp deep link with a pre-filled message. */
export function waLink(message: string): string {
  return `https://wa.me/${SITE.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/* ========================================================================== */
/* 2. NAVIGATION                                                              */
/* ========================================================================== */

export const NAV: { href: string; label: Bi }[] = [
  { href: "/", label: { en: "Home", gu: "[GU: Home]" } },
  { href: "/products", label: { en: "Products", gu: "[GU: Products]" } },
  { href: "/about", label: { en: "About", gu: "[GU: About]" } },
  { href: "/dealers", label: { en: "For Dealers", gu: "[GU: For Dealers]" } },
  { href: "/learn", label: { en: "Learn", gu: "[GU: Learn]" } },
  { href: "/contact", label: { en: "Contact", gu: "[GU: Contact]" } },
];

/* ========================================================================== */
/* 3. SHARED / UI STRINGS                                                     */
/* ========================================================================== */

export const UI = {
  askOnWhatsApp: { en: "Ask on WhatsApp", gu: "[GU: Ask on WhatsApp]" },
  chatOnWhatsApp: { en: "Chat on WhatsApp", gu: "[GU: Chat on WhatsApp]" },
  becomeADealer: { en: "Become a Dealer", gu: "[GU: Become a Dealer]" },
  viewAllProducts: { en: "See all products", gu: "[GU: See all products]" },
  learnMore: { en: "Learn more", gu: "[GU: Learn more]" },
  readArticle: { en: "Read article", gu: "[GU: Read article]" },
  dosage: { en: "Dosage", gu: "[GU: Dosage]" },
  application: { en: "How to apply", gu: "[GU: How to apply]" },
  crops: { en: "Works well with", gu: "[GU: Works well with]" },
  benefits: { en: "Why farmers use it", gu: "[GU: Why farmers use it]" },
  flagship: { en: "Flagship product", gu: "[GU: Flagship product]" },
  backToProducts: { en: "All products", gu: "[GU: All products]" },
  backToLearn: { en: "All articles", gu: "[GU: All articles]" },
  footerTagline: {
    en: "Biofertilizers made in North Gujarat, for the soil that has been worked too hard.",
    gu: "[GU: Biofertilizers made in North Gujarat, for the soil that has been worked too hard.]",
  },
} as const;

/* ========================================================================== */
/* 4. HOME PAGE                                                               */
/* ========================================================================== */

export const HOME = {
  heroIntro1: {
    en: "Roots to riches. Built for the soil that has been worked too hard.",
    gu: "[GU: Roots to riches. Built for the soil that has been worked too hard.]",
  },
  heroIntro2: {
    en: "Mycorrhizal cultures, NPK consortia and biostimulants formulated to work with the microbial life already in your field — not against it.",
    gu: "[GU: Mycorrhizal cultures, NPK consortia and biostimulants formulated to work with the microbial life already in your field — not against it.]",
  },
  heroCtaMessage:
    "Hello IKSARVA, I would like to know more about your biofertilizer products.",
  productsHeading: { en: "Our Products", gu: "[GU: Our Products]" },
  productsSub: {
    en: "Three ways to bring your soil back to life — starting with a 25-gram sachet.",
    gu: "[GU: Three ways to bring your soil back to life — starting with a 25-gram sachet.]",
  },
  regionHeading: {
    en: "Working where you farm",
    gu: "[GU: Working where you farm]",
  },
  regionSub: {
    en: "We are a North Gujarat company. Our products are tested in the same soil, water and weather your crops grow in.",
    gu: "[GU: We are a North Gujarat company. Our products are tested in the same soil, water and weather your crops grow in.]",
  },
  regions: [
    {
      district: { en: "Banaskantha", gu: "[GU: Banaskantha]" },
      focus: { en: "Potato farms", gu: "[GU: Potato farms]" },
      note: {
        en: "Supporting potato growers with soil biology that improves tuber size and count.",
        gu: "[GU: Supporting potato growers with soil biology that improves tuber size and count.]",
      },
    },
    {
      district: { en: "Sabarkantha", gu: "[GU: Sabarkantha]" },
      focus: { en: "Pomegranate orchards", gu: "[GU: Pomegranate orchards]" },
      note: {
        en: "Helping orchard owners get stronger flowering and better fruit set.",
        gu: "[GU: Helping orchard owners get stronger flowering and better fruit set.]",
      },
    },
    {
      district: { en: "Mehsana", gu: "[GU: Mehsana]" },
      focus: { en: "Dealer network", gu: "[GU: Dealer network]" },
      note: {
        en: "Our growing dealer network keeps products close to your village.",
        gu: "[GU: Our growing dealer network keeps products close to your village.]",
      },
    },
  ],
  missionHeading: {
    en: "Less chemical. More life.",
    gu: "[GU: Less chemical. More life.]",
  },
  missionBody: {
    en: "Years of heavy chemical fertilizer and pesticide use have left many fields tired — hard soil, weak roots, rising input costs. Our biofertilizers help you cut back on chemicals step by step, by putting the soil's own microbes back to work. Better crop quality, better yield, and soil that stays fertile for your children.",
    gu: "[GU: Years of heavy chemical fertilizer and pesticide use have left many fields tired — hard soil, weak roots, rising input costs. Our biofertilizers help you cut back on chemicals step by step, by putting the soil's own microbes back to work. Better crop quality, better yield, and soil that stays fertile for your children.]",
  },
  dealerStripHeading: {
    en: "Sell IKSARVA in your area",
    gu: "[GU: Sell IKSARVA in your area]",
  },
  dealerStripBody: {
    en: "We are expanding our dealer network across North Gujarat. Good margins, farmer demand, and full support from our team.",
    gu: "[GU: We are expanding our dealer network across North Gujarat. Good margins, farmer demand, and full support from our team.]",
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
      gu: "[GU: Flowering bio-stimulant]",
    },
    tagline: {
      en: "More flowers. Stronger fruit set. One 25g sachet per acre.",
      gu: "[GU: More flowers. Stronger fruit set. One 25g sachet per acre.]",
    },
    description: {
      en: "FloraMax is our flagship flowering bio-stimulant powder. It combines seaweed extract and humic acid to push your crop into strong, uniform flowering — so more flowers turn into fruit, and more fruit reaches harvest. It works with the plant's own growth rhythm, not against it.",
      gu: "[GU: FloraMax is our flagship flowering bio-stimulant powder. It combines seaweed extract and humic acid to push your crop into strong, uniform flowering — so more flowers turn into fruit, and more fruit reaches harvest. It works with the plant's own growth rhythm, not against it.]",
    },
    benefits: [
      {
        en: "More flowering and better fruit set — fewer dropped flowers",
        gu: "[GU: More flowering and better fruit set — fewer dropped flowers]",
      },
      {
        en: "Seaweed extract feeds the plant natural growth boosters",
        gu: "[GU: Seaweed extract feeds the plant natural growth boosters]",
      },
      {
        en: "Humic acid improves nutrient uptake through the roots",
        gu: "[GU: Humic acid improves nutrient uptake through the roots]",
      },
      {
        en: "Tiny dose, low cost per acre — just 25 grams",
        gu: "[GU: Tiny dose, low cost per acre — just 25 grams]",
      },
    ],
    dosage: {
      en: "25g per acre — one sachet. Dissolve in water and apply as a foliar spray at the start of flowering.",
      gu: "[GU: 25g per acre — one sachet. Dissolve in water and apply as a foliar spray at the start of flowering.]",
    },
    application: {
      en: "Mix one 25g sachet in 150–200 litres of water. Spray on leaves in the early morning or late evening, when flowering begins. Repeat once after 15–20 days if the flowering period is long.",
      gu: "[GU: Mix one 25g sachet in 150–200 litres of water. Spray on leaves in the early morning or late evening, when flowering begins. Repeat once after 15–20 days if the flowering period is long.]",
    },
    crops: {
      en: "Pomegranate, cumin, castor, cotton, vegetables, and other flowering crops grown across North Gujarat.",
      gu: "[GU: Pomegranate, cumin, castor, cotton, vegetables, and other flowering crops grown across North Gujarat.]",
    },
    format: {
      en: "25g powder sachet",
      gu: "[GU: 25g powder sachet]",
    },
    compliance: {
      en: "FCO Schedule VI compliant — registered biostimulant category under the S.O. 876(E) gazette amendment.",
      gu: "[GU: FCO Schedule VI compliant — registered biostimulant category under the S.O. 876(E) gazette amendment.]",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about FloraMax (25g flowering bio-stimulant).",
  },
  {
    slug: "mycho",
    name: "Mycho",
    art: "roots",
    category: {
      en: "Mycorrhizal inoculant",
      gu: "[GU: Mycorrhizal inoculant]",
    },
    tagline: {
      en: "Grow your roots an underground helper network.",
      gu: "[GU: Grow your roots an underground helper network.]",
    },
    description: {
      en: "Mycho is a mycorrhizal inoculant. Mycorrhizae are friendly fungi that attach to your crop's roots and spread thin threads far into the soil — like extra roots your plant didn't have to grow. They pull in water and nutrients from soil the roots alone could never reach.",
      gu: "[GU: Mycho is a mycorrhizal inoculant. Mycorrhizae are friendly fungi that attach to your crop's roots and spread thin threads far into the soil — like extra roots your plant didn't have to grow. They pull in water and nutrients from soil the roots alone could never reach.]",
    },
    benefits: [
      {
        en: "Extends root reach for water and nutrients, many times over",
        gu: "[GU: Extends root reach for water and nutrients, many times over]",
      },
      {
        en: "Crops handle dry spells better — a real help in low-rain years",
        gu: "[GU: Crops handle dry spells better — a real help in low-rain years]",
      },
      {
        en: "Better phosphorus uptake, so applied fertilizer is not wasted",
        gu: "[GU: Better phosphorus uptake, so applied fertilizer is not wasted]",
      },
      {
        en: "Builds living soil structure that lasts beyond one season",
        gu: "[GU: Builds living soil structure that lasts beyond one season]",
      },
    ],
    dosage: {
      en: "Apply at sowing or transplanting, close to the seed or root zone. Ask us for the right rate for your crop and soil.",
      gu: "[GU: Apply at sowing or transplanting, close to the seed or root zone. Ask us for the right rate for your crop and soil.]",
    },
    application: {
      en: "Best applied once, early — at sowing, transplanting, or first irrigation — so the fungi can attach to young roots. Avoid mixing with chemical fungicides in the same application.",
      gu: "[GU: Best applied once, early — at sowing, transplanting, or first irrigation — so the fungi can attach to young roots. Avoid mixing with chemical fungicides in the same application.]",
    },
    crops: {
      en: "Potato, pomegranate, wheat, maize, vegetables — almost every crop except mustard-family crops, which do not partner with mycorrhizae.",
      gu: "[GU: Potato, pomegranate, wheat, maize, vegetables — almost every crop except mustard-family crops, which do not partner with mycorrhizae.]",
    },
    format: {
      en: "Powder / granular inoculant",
      gu: "[GU: Powder / granular inoculant]",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about Mycho (mycorrhizal inoculant).",
  },
  {
    slug: "npk-consortia",
    name: "NPK Consortia",
    art: "network",
    category: {
      en: "Bacterial consortium",
      gu: "[GU: Bacterial consortium]",
    },
    tagline: {
      en: "Three teams of bacteria. One job: feed your crop.",
      gu: "[GU: Three teams of bacteria. One job: feed your crop.]",
    },
    description: {
      en: "NPK Consortia is a blend of three kinds of helpful bacteria: nitrogen-fixers that pull nitrogen from the air, phosphate-solubilizers that unlock phosphorus stuck in your soil, and potash-mobilizers that free up potassium. Together they supply the same N-P-K your crop needs — from the soil and air, not just from a bag.",
      gu: "[GU: NPK Consortia is a blend of three kinds of helpful bacteria: nitrogen-fixers that pull nitrogen from the air, phosphate-solubilizers that unlock phosphorus stuck in your soil, and potash-mobilizers that free up potassium. Together they supply the same N-P-K your crop needs — from the soil and air, not just from a bag.]",
    },
    benefits: [
      {
        en: "Cuts your chemical urea and DAP requirement step by step",
        gu: "[GU: Cuts your chemical urea and DAP requirement step by step]",
      },
      {
        en: "Unlocks phosphorus and potash already locked in your soil",
        gu: "[GU: Unlocks phosphorus and potash already locked in your soil]",
      },
      {
        en: "Keeps feeding the crop through the season, not in one burst",
        gu: "[GU: Keeps feeding the crop through the season, not in one burst]",
      },
      {
        en: "Safe for soil life, earthworms and the next crop",
        gu: "[GU: Safe for soil life, earthworms and the next crop]",
      },
    ],
    dosage: {
      en: "Apply through seed treatment, soil application with compost, or drip irrigation. Ask us for the right rate for your crop.",
      gu: "[GU: Apply through seed treatment, soil application with compost, or drip irrigation. Ask us for the right rate for your crop.]",
    },
    application: {
      en: "Works best applied to moist soil, mixed with well-decomposed farmyard manure or through drip. Keep a gap of a few days between this and any chemical fungicide or bactericide.",
      gu: "[GU: Works best applied to moist soil, mixed with well-decomposed farmyard manure or through drip. Keep a gap of a few days between this and any chemical fungicide or bactericide.]",
    },
    crops: {
      en: "Potato, wheat, cumin, castor, cotton, vegetables — all major crops of Banaskantha, Sabarkantha and Mehsana.",
      gu: "[GU: Potato, wheat, cumin, castor, cotton, vegetables — all major crops of Banaskantha, Sabarkantha and Mehsana.]",
    },
    format: {
      en: "Liquid / carrier-based formulation",
      gu: "[GU: Liquid / carrier-based formulation]",
    },
    whatsappMessage:
      "Hello IKSARVA, I want to know more about NPK Consortia (bacterial consortium).",
  },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

/* ========================================================================== */
/* 6. ABOUT PAGE                                                              */
/* ========================================================================== */

export const ABOUT = {
  heading: { en: "About IKSARVA", gu: "[GU: About IKSARVA]" },
  missionHeading: { en: "Our mission", gu: "[GU: Our mission]" },
  missionBody1: {
    en: "IKSARVA Agritech was started with one belief: the soil of North Gujarat has been worked too hard, and it deserves better than more chemicals. Every season of heavy urea, DAP and pesticide use pushes yields up for a year — and pushes soil health down for a decade.",
    gu: "[GU: IKSARVA Agritech was started with one belief: the soil of North Gujarat has been worked too hard, and it deserves better than more chemicals. Every season of heavy urea, DAP and pesticide use pushes yields up for a year — and pushes soil health down for a decade.]",
  },
  missionBody2: {
    en: "We make biofertilizers — mycorrhizal cultures, bacterial consortia and biostimulants — that work with the microbial life already in your field, not against it. Our goal is simple: help farmers reduce their dependence on toxic chemical inputs, improve crop quality and quantity, and hand the next generation soil that is alive.",
    gu: "[GU: We make biofertilizers — mycorrhizal cultures, bacterial consortia and biostimulants — that work with the microbial life already in your field, not against it. Our goal is simple: help farmers reduce their dependence on toxic chemical inputs, improve crop quality and quantity, and hand the next generation soil that is alive.]",
  },
  philosophyHeading: {
    en: "Our soil-health philosophy",
    gu: "[GU: Our soil-health philosophy]",
  },
  philosophyBody: {
    en: "A handful of healthy soil holds more living organisms than there are people on Earth. Those microbes already know how to feed your crop — fix nitrogen, unlock phosphorus, extend roots, fight disease. Chemicals silence them; biology wakes them up. We don't ask farmers to change everything overnight. Start with one product, one field, one season — and watch the difference.",
    gu: "[GU: A handful of healthy soil holds more living organisms than there are people on Earth. Those microbes already know how to feed your crop — fix nitrogen, unlock phosphorus, extend roots, fight disease. Chemicals silence them; biology wakes them up. We don't ask farmers to change everything overnight. Start with one product, one field, one season — and watch the difference.]",
  },
  teamHeading: { en: "The team", gu: "[GU: The team]" },
  founders: [
    {
      /** PLACEHOLDER — replace with the founder's name */
      name: "[Founder name]",
      role: {
        en: "Co-founder — Agri Science & Field Operations",
        gu: "[GU: Co-founder — Agri Science & Field Operations]",
      },
      bio: {
        en: "Leads product formulation, field trials and farmer training across Banaskantha, Sabarkantha and Mehsana.",
        gu: "[GU: Leads product formulation, field trials and farmer training across Banaskantha, Sabarkantha and Mehsana.]",
      },
    },
    {
      /** PLACEHOLDER — replace with the founder's name */
      name: "[Founder name]",
      role: {
        en: "Co-founder — Technology & Marketing",
        gu: "[GU: Co-founder — Technology & Marketing]",
      },
      bio: {
        en: "Leads technology, dealer partnerships and getting IKSARVA products into farmers' hands.",
        gu: "[GU: Leads technology, dealer partnerships and getting IKSARVA products into farmers' hands.]",
      },
    },
  ],
  regionHeading: {
    en: "Rooted in North Gujarat",
    gu: "[GU: Rooted in North Gujarat]",
  },
  regionBody: {
    en: "We work where we live: the potato belts of Banaskantha, the pomegranate orchards of Sabarkantha, and a growing dealer network centred on Mehsana. When we recommend a dose, it is because we have seen it work in this soil, in this water, in this heat.",
    gu: "[GU: We work where we live: the potato belts of Banaskantha, the pomegranate orchards of Sabarkantha, and a growing dealer network centred on Mehsana. When we recommend a dose, it is because we have seen it work in this soil, in this water, in this heat.]",
  },
} as const;

/* ========================================================================== */
/* 7. DEALERS PAGE                                                            */
/* ========================================================================== */

export const DEALERS = {
  heading: {
    en: "Become an IKSARVA dealer",
    gu: "[GU: Become an IKSARVA dealer]",
  },
  intro: {
    en: "Farmers are asking for alternatives to costly chemicals. Stock the products they are asking for — with good margins and a team that supports you.",
    gu: "[GU: Farmers are asking for alternatives to costly chemicals. Stock the products they are asking for — with good margins and a team that supports you.]",
  },
  points: [
    {
      title: { en: "Growing demand", gu: "[GU: Growing demand]" },
      body: {
        en: "Input costs are rising and farmers are actively looking for biofertilizers that work. You sell what the market is already asking for.",
        gu: "[GU: Input costs are rising and farmers are actively looking for biofertilizers that work. You sell what the market is already asking for.]",
      },
    },
    {
      title: { en: "Healthy margins", gu: "[GU: Healthy margins]" },
      body: {
        en: "Dealer-first pricing with clear, honest terms. Small pack sizes like the 25g FloraMax sachet mean easy stocking and fast turnover.",
        gu: "[GU: Dealer-first pricing with clear, honest terms. Small pack sizes like the 25g FloraMax sachet mean easy stocking and fast turnover.]",
      },
    },
    {
      title: { en: "Real support", gu: "[GU: Real support]" },
      body: {
        en: "Product training, farmer demos in your area, and marketing material in Gujarati. We help you build trust with your customers.",
        gu: "[GU: Product training, farmer demos in your area, and marketing material in Gujarati. We help you build trust with your customers.]",
      },
    },
    {
      title: { en: "Compliant products", gu: "[GU: Compliant products]" },
      body: {
        en: "FloraMax is FCO Schedule VI compliant. Sell with confidence — the paperwork is in order.",
        gu: "[GU: FloraMax is FCO Schedule VI compliant. Sell with confidence — the paperwork is in order.]",
      },
    },
  ],
  ctaHeading: {
    en: "Interested? Talk to us today.",
    gu: "[GU: Interested? Talk to us today.]",
  },
  ctaBody: {
    en: "Send us a message on WhatsApp with your name, shop name and taluka. We will get back within one working day.",
    gu: "[GU: Send us a message on WhatsApp with your name, shop name and taluka. We will get back within one working day.]",
  },
  whatsappMessage:
    "Hello IKSARVA, I am interested in becoming a dealer. My name / shop / taluka: ",
} as const;

/* ========================================================================== */
/* 8. LEARN PAGE                                                              */
/* ========================================================================== */

export const LEARN = {
  heading: { en: "Knowledge for your field", gu: "[GU: Knowledge for your field]" },
  intro: {
    en: "Plain-language guides on soil health, soil biology, and how to cut chemical inputs without cutting your yield.",
    gu: "[GU: Plain-language guides on soil health, soil biology, and how to cut chemical inputs without cutting your yield.]",
  },
} as const;

/* ========================================================================== */
/* 9. CONTACT PAGE                                                            */
/* ========================================================================== */

export const CONTACT = {
  heading: { en: "Talk to us", gu: "[GU: Talk to us]" },
  intro: {
    en: "WhatsApp is the fastest way to reach us — for product questions, dosages, dealer inquiries, or anything about your field.",
    gu: "[GU: WhatsApp is the fastest way to reach us — for product questions, dosages, dealer inquiries, or anything about your field.]",
  },
  whatsappMessage: "Hello IKSARVA, I have a question.",
  phoneLabel: { en: "Phone", gu: "[GU: Phone]" },
  emailLabel: { en: "Email", gu: "[GU: Email]" },
  locationLabel: { en: "Location", gu: "[GU: Location]" },
  locationValue: {
    en: "Mehsana, North Gujarat, India",
    gu: "[GU: Mehsana, North Gujarat, India]",
  },
  hoursNote: {
    en: "We reply on WhatsApp between 9 AM and 7 PM, Monday to Saturday.",
    gu: "[GU: We reply on WhatsApp between 9 AM and 7 PM, Monday to Saturday.]",
  },
} as const;
