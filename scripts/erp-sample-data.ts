/**
 * The shapes the ERP sample data is built from.
 *
 * Separate from erp-sample.ts so importing the generators does not run the
 * script — the same split as crm-sample-data.ts.
 *
 * These SKUs mirror IKSARVA's real three, with plausible prices. They are NOT
 * written onto the Product records: an invoice line is a self-contained
 * snapshot, so sample invoices carry their own figures and nothing here can
 * put a made-up price on a real product.
 */

export interface SampleSku {
  name: string;
  pack: string;
  hsn: string;
  gstRateBps: number;
  farmerPaise: number;
  dealerPaise: number;
}

export const SAMPLE_SKUS: SampleSku[] = [
  {
    name: "FloraMax",
    pack: "25 g sachet",
    hsn: "31010099",
    gstRateBps: 500,
    farmerPaise: 24500,
    dealerPaise: 19500,
  },
  {
    name: "Mycorrhizal",
    pack: "250 g canister",
    hsn: "31010099",
    gstRateBps: 500,
    farmerPaise: 39000,
    dealerPaise: 31500,
  },
  {
    name: "NPK Consortia",
    pack: "500 g canister",
    hsn: "31010099",
    gstRateBps: 500,
    farmerPaise: 52000,
    dealerPaise: 42000,
  },
];

export function buildStockItems() {
  return [
    {
      name: "FloraMax 25 g sachet",
      sku: "IKS-FLM-025",
      kind: "finished",
      unit: "sachet",
      onHand: 420,
      reorderLevel: 150,
      unitCostPaise: 9800,
      location: "Kheradi store",
    },
    {
      name: "Mycorrhizal 250 g canister",
      sku: "IKS-MYC-250",
      kind: "finished",
      unit: "canister",
      // Below its reorder level on purpose, so the alert has something to show.
      onHand: 38,
      reorderLevel: 60,
      unitCostPaise: 17500,
      location: "Kheradi store",
    },
    {
      name: "NPK Consortia 500 g canister",
      sku: "IKS-NPK-500",
      kind: "finished",
      unit: "canister",
      onHand: 96,
      reorderLevel: 60,
      unitCostPaise: 23000,
      location: "Kheradi store",
    },
    {
      name: "Printed sachet film",
      kind: "packaging",
      unit: "kg",
      onHand: 12,
      reorderLevel: 25,
      unitCostPaise: 42000,
      supplier: "Shree Poly Pack",
    },
    {
      name: "250 g HDPE canister",
      kind: "packaging",
      unit: "piece",
      onHand: 640,
      reorderLevel: 200,
      unitCostPaise: 1400,
      supplier: "Gokul Containers",
    },
    {
      name: "Product labels — FloraMax",
      kind: "packaging",
      unit: "piece",
      onHand: 1800,
      reorderLevel: 500,
      unitCostPaise: 120,
      supplier: "Vraj Printers",
    },
    {
      name: "Carrier medium (lignite)",
      kind: "raw",
      unit: "kg",
      onHand: 310,
      reorderLevel: 100,
      unitCostPaise: 3200,
      supplier: "Sabar Minerals",
    },
  ].map((item) => ({ ...item, isSample: true, countedAt: new Date(), updatedBy: "erp-sample" }));
}

/**
 * The suppliers the stock items and purchases below name, as records.
 *
 * Seeded FIRST, so every sample bill can carry a supplierId the way a real
 * one does; erp-sample.ts links them by name after insert.
 */
export function buildSuppliers() {
  return [
    { name: "Shree Poly Pack", gstin: "24AABCS1429B1Z1", city: "Ahmedabad" },
    { name: "Gokul Containers", gstin: "24AAECG7712M1ZP", city: "Rajkot" },
    { name: "Sabar Minerals", gstin: "24AAFFS9021K1ZR", city: "Himatnagar" },
    { name: "Vraj Printers", gstin: "", city: "Mehsana" },
    { name: "Anand Biotech Labs", gstin: "24AADCA3388J1ZK", city: "Anand" },
    { name: "Patel Transport", gstin: "24AAGFP5540L1ZQ", city: "Mehsana" },
    { name: "Local tempo hire", gstin: "", city: "" },
    { name: "Skyline Digital", gstin: "24AAJCS2201F1ZW", city: "Gandhinagar" },
    { name: "Nirav & Associates", gstin: "24AAKFN8834C1ZD", city: "Ahmedabad" },
  ].map((s) => ({ ...s, state: "Gujarat", isSample: true, updatedBy: "erp-sample" }));
}

export function buildPurchases() {
  const day = 86_400_000;
  const now = Date.now();

  const rows = [
    { supplier: "Shree Poly Pack", gstin: "24AABCS1429B1Z1", category: "packaging", description: "Printed sachet film 40 kg", taxable: 1680000, rate: 1800, days: 12 },
    { supplier: "Gokul Containers", gstin: "24AAECG7712M1ZP", category: "packaging", description: "250 g canisters × 1000", taxable: 1400000, rate: 1800, days: 26 },
    { supplier: "Sabar Minerals", gstin: "24AAFFS9021K1ZR", category: "raw_material", description: "Lignite carrier 500 kg", taxable: 1600000, rate: 500, days: 41 },
    { supplier: "Vraj Printers", gstin: "", category: "packaging", description: "Labels — three SKUs", taxable: 420000, rate: 1200, days: 55 },
    { supplier: "Anand Biotech Labs", gstin: "24AADCA3388J1ZK", category: "job_work", description: "Culture multiplication — batch 09", taxable: 3500000, rate: 1800, days: 63 },
    // Freight, paid personally — see paidBy below. Their real sheet shows the
    // same thing: transport recorded, never once charged to a customer.
    { supplier: "Patel Transport", gstin: "24AAGFP5540L1ZQ", category: "freight", description: "Freight to Mehsana dealers", taxable: 180000, rate: 500, days: 9 },
    { supplier: "Local tempo hire", gstin: "", category: "freight", description: "Deliveries — Bhiloda and Kheradi", taxable: 62000, rate: 0, days: 20 },
    { supplier: "Skyline Digital", gstin: "24AAJCS2201F1ZW", category: "marketing", description: "Field-day banners and leaflets", taxable: 650000, rate: 1800, days: 78 },
    { supplier: "Nirav & Associates", gstin: "24AAKFN8834C1ZD", category: "services", description: "Accounting retainer — quarter", taxable: 900000, rate: 1800, days: 33 },
  ];

  return rows.map((r, i) => {
    // Intra-state for all but one, so the IGST column is not always empty.
    const interState = i === 4;
    const tax = Math.round((r.taxable * r.rate) / 10_000);
    const cgst = interState ? 0 : Math.trunc(tax / 2);
    const sgst = interState ? 0 : tax - cgst;
    const igst = interState ? tax : 0;

    return {
      supplier: r.supplier,
      supplierGstin: r.gstin,
      billNo: `${r.supplier.slice(0, 3).toUpperCase()}/25-26/${100 + i}`,
      billDate: new Date(now - r.days * day),
      category: r.category,
      description: r.description,
      taxableValuePaise: r.taxable,
      cgstPaise: cgst,
      sgstPaise: sgst,
      igstPaise: igst,
      totalPaise: r.taxable + tax,
      // No GSTIN means no input credit to claim — the one case where the flag
      // is not a judgement call.
      inputCreditEligible: Boolean(r.gstin) && r.category !== "freight",
      /*
        Freight is the case the flag exists for: the directors pay it out of
        their own pockets, so it is a cost the company owes back rather than
        company money that went out.
      */
      paidBy: r.category === "freight" ? "director" : "company",
      paidByName: r.category === "freight" ? "Director" : "",
      paymentStatus: i % 3 === 0 ? "unpaid" : "paid",
      paidPaise: i % 3 === 0 ? 0 : r.taxable + tax,
      isSample: true,
      updatedBy: "erp-sample",
    };
  });
}
