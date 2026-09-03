import { SELLER } from "@/lib/content";

/**
 * Who is selling — IKSARVA's own tax identity and where money should go.
 *
 * Until now this was a constant in lib/content.ts, which meant changing a
 * bank account was a code change and a deploy. It is now a SETTING, held in
 * one Settings document and edited on /admin/settings by an owner. The
 * constant stays as the fallback used until somebody saves that page, so
 * nothing changes on the day this ships.
 *
 * Two rules, both borrowed from the party snapshot on an invoice:
 *
 * 1. PAN and state code are DERIVED from the GSTIN, never typed. Characters
 *    3–12 of a GSTIN are the PAN and the first two are the state. Three
 *    fields typed from three documents can disagree; one field cannot.
 * 2. Every invoice carries a COPY of this at issue (`Invoice.seller`). A
 *    bank account changed in October must not appear on a September invoice
 *    reprinted in November — the print page reads the invoice's copy.
 *
 * Dependency-free on purpose (lib/content.ts imports nothing but types), so
 * the form can validate with it in the browser and a script can read it.
 */

export interface SellerBank {
  accountName: string;
  name: string;
  accountNo: string;
  ifsc: string;
  upi: string;
}

export interface Seller {
  gstin: string;
  /** Characters 3–12 of the GSTIN. Never typed. */
  pan: string;
  /** The first two characters of the GSTIN. Never typed. */
  stateCode: string;
  bank: SellerBank;
}

/** What the Settings form holds — the GSTIN and the bank, nothing derived. */
export interface SellerInput {
  gstin: string;
  bank: SellerBank;
}

/** The one Settings document's id. A string, so the URL and the log can name it. */
export const SELLER_SETTINGS_ID = "seller";

/** What every invoice said until the Settings page was first saved. */
export const DEFAULT_SELLER: Seller = deriveSeller({
  gstin: SELLER.gstin,
  bank: { ...SELLER.bank },
});

/** The full identity from what was typed: PAN and state read off the GSTIN. */
export function deriveSeller(input: SellerInput): Seller {
  const gstin = input.gstin.trim().toUpperCase();
  return {
    gstin,
    pan: gstin.length === 15 ? gstin.slice(2, 12) : "",
    stateCode: gstin.length >= 2 ? gstin.slice(0, 2) : "",
    bank: {
      accountName: input.bank.accountName.trim(),
      name: input.bank.name.trim(),
      accountNo: input.bank.accountNo.trim(),
      ifsc: input.bank.ifsc.trim().toUpperCase(),
      upi: input.bank.upi.trim().toLowerCase(),
    },
  };
}

/**
 * The seller as a stored document or an invoice's snapshot reads it.
 *
 * `null` is an invoice issued before the snapshot existed. Those were
 * printed from the constant, so the constant is what they still say.
 */
export function sellerFrom(
  doc:
    | { gstin?: unknown; pan?: unknown; stateCode?: unknown; bank?: unknown }
    | null
    | undefined,
): Seller {
  if (!doc || typeof doc.gstin !== "string") return DEFAULT_SELLER;
  const bank = (doc.bank ?? {}) as Partial<Record<keyof SellerBank, unknown>>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    gstin: doc.gstin,
    pan: str(doc.pan),
    stateCode: str(doc.stateCode),
    bank: {
      accountName: str(bank.accountName),
      name: str(bank.name),
      accountNo: str(bank.accountNo),
      ifsc: str(bank.ifsc),
      upi: str(bank.upi),
    },
  };
}

/**
 * The seller as one flat record, for the audit log.
 *
 * The log diffs top-level keys, and renders a nested object as a list of its
 * key names — so a changed account number would have read "bank: accountName,
 * name, accountNo… → accountName, name, accountNo…". Flat, each field shows
 * its own from → to.
 */
export function sellerAuditShape(seller: Seller): Record<string, string> {
  return {
    gstin: seller.gstin,
    pan: seller.pan,
    stateCode: seller.stateCode,
    bankAccountName: seller.bank.accountName,
    bankName: seller.bank.name,
    bankAccountNo: seller.bank.accountNo,
    bankIfsc: seller.bank.ifsc,
    bankUpi: seller.bank.upi,
  };
}
