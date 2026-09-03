import { connectToDatabase } from "@/lib/db/connect";
import { Settings } from "@/lib/db/models/Settings";
import {
  DEFAULT_SELLER,
  SELLER_SETTINGS_ID,
  sellerFrom,
  type Seller,
} from "@/lib/erp/seller";

/**
 * The seller as the NEXT invoice will print it.
 *
 * Read at issue by issueInvoice(), which copies it onto the document; read
 * by the GST page for the heading. Never read for an invoice already issued
 * — that one carries its own copy.
 */
export interface SellerSettings {
  seller: Seller;
  /** Mongoose __v, so the Settings form can refuse a stale save. */
  version: number;
  /** False until the page has been saved once; the constant is in force. */
  saved: boolean;
  updatedAt: string | null;
  updatedBy: string;
}

export async function getSellerSettings(): Promise<SellerSettings> {
  await connectToDatabase();
  const doc = await Settings.findById(SELLER_SETTINGS_ID).lean();
  if (!doc) {
    return { seller: DEFAULT_SELLER, version: 0, saved: false, updatedAt: null, updatedBy: "" };
  }
  return {
    seller: sellerFrom(doc),
    version: typeof doc.__v === "number" ? doc.__v : 0,
    saved: true,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
    updatedBy: doc.updatedBy ?? "",
  };
}

export async function getSeller(): Promise<Seller> {
  return (await getSellerSettings()).seller;
}
