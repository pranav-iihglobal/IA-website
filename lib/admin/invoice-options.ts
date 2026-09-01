import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/db/models/Product";
import { Contact } from "@/lib/db/models/Contact";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * What the invoice form needs to know before anyone types anything.
 *
 * Loaded once per page render and filtered in the browser, the same as
 * lib/admin/products-options.ts: three products and a few hundred customers is
 * far less data than a query per keystroke would cost the M0 cluster.
 *
 * Each returns an empty list if the database is unreachable, so the form still
 * renders and says it has nothing rather than failing to appear.
 */

export interface BillablePack {
  label: string;
  /** Paise, or null where nobody has set that price yet. */
  mrpPaise: number | null;
  farmerPricePaise: number | null;
  dealerPricePaise: number | null;
}

export interface BillableProduct {
  id: string;
  name: string;
  sku: string;
  hsnCode: string;
  /**
   * Basis points, for DISPLAY only. The form shows it so the person raising
   * the invoice can see what will be charged; it never sends it back. The
   * server reads the rate from this same record at issue — see
   * snapshotLine() in lib/erp/invoice.ts.
   */
  gstRateBps: number | null;
  packs: BillablePack[];
  /** Set when this product cannot be invoiced yet, and why. */
  blockedReason: string | null;
}

/** Paise or null — an unset price must not arrive as a zero. */
function paise(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

export async function getBillableProducts(): Promise<BillableProduct[]> {
  try {
    await connectToDatabase();
    const docs = await Product.find()
      .select("name sku hsnCode gstRateBps packSizes displayOrder")
      .sort({ displayOrder: 1 })
      .lean();

    return docs.map((p: LeanDoc) => {
      const gstRateBps = typeof p.gstRateBps === "number" ? p.gstRateBps : null;
      /*
        Why a product is not invoiceable is worked out here rather than left
        for the server to reject after the form has been filled in. The API
        refuses these too — that is the real guard — but discovering it at the
        moment of issue, having typed six lines, is a poor way to find out.
      */
      const missing: string[] = [];
      if (gstRateBps === null) missing.push("a GST rate");
      if (!p.hsnCode) missing.push("an HSN code");

      return {
        id: String(p._id),
        name: p.name?.en ?? "(untitled)",
        sku: p.sku ?? "",
        hsnCode: p.hsnCode ?? "",
        gstRateBps,
        packs: (p.packSizes ?? []).map((pack: LeanDoc) => ({
          label: pack.label ?? "",
          mrpPaise: paise(pack.mrpPaise),
          farmerPricePaise: paise(pack.farmerPricePaise),
          dealerPricePaise: paise(pack.dealerPricePaise),
        })),
        blockedReason: missing.length
          ? `Needs ${missing.join(" and ")} before it can be invoiced.`
          : null,
      };
    });
  } catch (error) {
    console.error("[admin] could not load billable products:", error);
    return [];
  }
}

export interface BillableParty {
  id: string;
  name: string;
  hint: string;
  /** B2B when present. Its absence is what makes a sale B2CS on the return. */
  gstin: string;
  /** b2c or b2b — decides which price the form suggests. */
  channel: string;
}

export async function getBillableParties(): Promise<BillableParty[]> {
  try {
    await connectToDatabase();
    // Customers and dealers only. A lead has not bought anything, and offering
    // one here would invite raising an invoice against somebody who has not.
    const docs = await Contact.find({ kind: "customer" })
      .select("name businessName contactId village district channel dealer")
      .sort({ name: 1 })
      .limit(2000)
      .lean();

    return docs.map((c: LeanDoc) => ({
      id: String(c._id),
      name: c.businessName || c.name || "(unnamed)",
      hint:
        [c.contactId, c.village, c.district].filter(Boolean).join(" · ") ||
        undefined,
      gstin: c.dealer?.gstin ?? "",
      channel: c.channel ?? "",
    })) as BillableParty[];
  } catch (error) {
    console.error("[admin] could not load billable parties:", error);
    return [];
  }
}
