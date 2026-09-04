import type { Bi } from "@/lib/content";
import type { ProductFormValues } from "@/components/admin/ProductForm";
import type { PostFormValues } from "@/components/admin/PostForm";
import type { TestimonialFormValues } from "@/components/admin/TestimonialForm";
import type { StockFormValues } from "@/components/admin/StockForm";
import type { PurchaseFormValues } from "@/components/admin/PurchaseForm";
import type { SupplierFormValues } from "@/components/admin/SupplierForm";
import type { SellerFormValues } from "@/components/admin/SellerSettingsForm";
import type { ContactFormValues } from "@/components/admin/ContactForm";

/**
 * What every form starts from, in one PLAIN module.
 *
 * These used to be exported from the form files themselves, which are
 * "use client". A value exported from a client module is not that value on
 * the server — it is a client REFERENCE, an opaque object React resolves in
 * the browser. Passing one straight through as a prop happens to work.
 * READING one does not: NewContactPage spread `emptyContact()` and three
 * edit pages spread `EMPTY_PRODUCT`, `EMPTY_POST` and `EMPTY_TESTIMONIAL`
 * over a stored record, and PURCHASE_CATEGORIES.find() on the purchase and
 * supplier pages threw "is not a function" in production. The spreads did
 * not throw; they silently copied nothing.
 *
 * Type imports only, so nothing here pulls a client module into a server
 * bundle. lib/admin/form-defaults.test.ts asserts no server file reads a
 * value from a client module again.
 */

const EMPTY_BI: Bi = { en: "", gu: "" };

export const EMPTY_PRODUCT: ProductFormValues = {
  name: { ...EMPTY_BI },
  slug: "",
  category: "other",
  categoryLabel: { ...EMPTY_BI },
  tagline: { ...EMPTY_BI },
  description: { ...EMPTY_BI },
  benefits: [],
  format: { ...EMPTY_BI },
  complianceNote: { ...EMPTY_BI },
  whatsappMessage: "",
  dosage: {
    amountPerAcre: "",
    unit: "g",
    summary: { ...EMPTY_BI },
    applicationMethod: { ...EMPTY_BI },
    cropStage: { ...EMPTY_BI },
  },
  suitableCrops: [],
  cropsNote: { ...EMPTY_BI },
  sku: "",
  hsnCode: "",
  gstRatePercent: 0,
  composition: [],
  packSizes: [],
  regulatory: { fcoCompliant: false, fcoSchedule: "", licenseNo: "" },

  assets: [],
  applicationSteps: [],
  fieldResults: [],
  faqs: [],
  relatedProducts: [],
  pairsWellWith: [],
  pinnedTestimonials: [],
  availability: "in_stock",
  availabilityNote: { ...EMPTY_BI },

  images: [],
  artFallback: "sachet",
  status: "draft",
  featured: false,
  displayOrder: 0,
};

export const EMPTY_POST: PostFormValues = {
  title: { ...EMPTY_BI },
  slug: "",
  excerpt: { ...EMPTY_BI },
  content: { ...EMPTY_BI },
  coverImage: { url: "", publicId: "", alt: { ...EMPTY_BI } },
  tags: [],
  category: "other",
  status: "draft",
  publishAt: null,
  author: "IKSARVA Team",
  metaTitle: { ...EMPTY_BI },
  metaDescription: { ...EMPTY_BI },
  pinnedTestimonials: [],
};

export const EMPTY_TESTIMONIAL: TestimonialFormValues = {
  farmerName: { ...EMPTY_BI },
  village: "",
  taluka: "",
  district: "",
  crop: { ...EMPTY_BI },
  quote: { ...EMPTY_BI },
  photo: { url: "", publicId: "" },
  video: { platform: "", url: "", embedId: "" },
  productUsed: null,
  rating: "",
  source: "admin_entered",
  verified: false,
  verifiedVia: "",
  status: "draft",
  featured: false,
  displayOrder: 0,
};

export const EMPTY_STOCK: StockFormValues = {
  name: "",
  sku: "",
  kind: "finished",
  unit: "unit",
  productId: "",
  packLabel: "",
  onHand: "0",
  reorderLevel: "0",
  unitCost: "",
  supplierId: "",
  supplier: "",
  location: "",
  notes: "",
};

export const EMPTY_PURCHASE: PurchaseFormValues = {
  supplierId: "",
  supplier: "",
  supplierGstin: "",
  billNo: "",
  billDate: "",
  category: "raw_material",
  description: "",
  taxableValue: "",
  cgst: "",
  sgst: "",
  igst: "",
  total: "",
  inputCreditEligible: true,
  paidBy: "company",
  paidByName: "",
  paymentStatus: "unpaid",
  paid: "",
  notes: "",
};

export const EMPTY_SUPPLIER: SupplierFormValues = {
  name: "",
  gstin: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  state: "Gujarat",
  notes: "",
};

/** Only for the coverage test: the Settings page always loads a stored or default seller. */
export const EMPTY_SELLER: SellerFormValues = {
  gstin: "",
  bank: { accountName: "", name: "", accountNo: "", ifsc: "", upi: "" },
};

export function emptyContact(): ContactFormValues {
  return {
    contactId: "",
    kind: "lead",
    channel: "",
    stage: "customer",
    name: "",
    nameGu: "",
    businessName: "",
    phone: "",
    altPhone: "",
    email: "",
    village: "",
    taluka: "",
    district: "",
    region: "",
    pin: "",
    state: "Gujarat",
    crop: "",
    acres: null,
    source: "other",
    gjZone: "",
    tags: [],
    owner: "",
    followUpAt: null,
    lastContactAt: null,
    remarks: "",
    lead: {},
    customer: {},
    dealer: {},
  };
}
