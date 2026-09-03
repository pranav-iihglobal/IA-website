/**
 * What a purchase can be, with the label each shows.
 *
 * A PLAIN module, with no "use client" and no imports, because both halves
 * need it: the form and the list are client components, the purchase and
 * supplier pages are server components. It used to live in PurchaseForm.tsx,
 * a "use client" file — and a value exported from one of those is not the
 * value on the server, it is a client REFERENCE. Reading it there gave
 * `PURCHASE_CATEGORIES.find is not a function`, which took down every
 * purchase detail page and any supplier page with a bill on it.
 *
 * The model keeps its own string tuple for the enum (lib/db/models/Purchase.ts
 * imports Mongoose and cannot come here); a test holds the two in step.
 */
export const PURCHASE_CATEGORIES = [
  { value: "raw_material", label: "Raw material" },
  { value: "packaging", label: "Packaging" },
  { value: "job_work", label: "Job work" },
  { value: "freight", label: "Freight" },
  { value: "marketing", label: "Marketing" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
] as const;

export function purchaseCategoryLabel(value: string): string {
  return PURCHASE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
