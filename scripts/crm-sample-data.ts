/**
 * Generated sample CRM records — pure, no database access.
 *
 * Split from the CLI in crm-sample.ts for the same reason seed-data.ts is
 * split from seed.ts: importing the generator to check it must not also run
 * the script. It did, the first time, and tried to connect to Atlas.
 *
 * Nothing here is real. Names are drawn from common Gujarati surnames, phone
 * numbers come from a reserved example block, and the GSTINs are structurally
 * shaped but deliberately invalid.
 */

/* Real place names from the districts IKSARVA actually sells into, so the
   lists look and sort like the real thing rather than like Lorem Ipsum. */
const PLACES: { district: string; region: string; talukas: string[] }[] = [
  { district: "Mehsana", region: "North Gujarat", talukas: ["Vijapur", "Vadnagar", "Kadi", "Visnagar"] },
  { district: "Banaskantha", region: "North Gujarat", talukas: ["Lakhani", "Deesa", "Palanpur", "Dhanera"] },
  { district: "Sabarkantha", region: "North Gujarat", talukas: ["Vijaynagar", "Idar", "Himatnagar"] },
  { district: "Patan", region: "North Gujarat", talukas: ["Sidhpur", "Chanasma", "Radhanpur"] },
  { district: "Gandhinagar", region: "North Gujarat", talukas: ["Dehgam", "Kalol", "Mansa"] },
  { district: "Surendranagar", region: "Saurashtra", talukas: ["Dhrangadhra", "Muli", "Halvad"] },
  { district: "Kachchh", region: "Kachchh", talukas: ["Nakhatrana", "Bhuj", "Anjar"] },
  { district: "Narmada", region: "South Gujarat", talukas: ["Nandod", "Dediapada"] },
];

const VILLAGES = ["Kherva", "Bharada", "Trikampura", "Karbatiya", "Jakhora", "Ughedi", "Lachras", "Dera", "Ashram", "Kharvasa"];
const FIRST = ["Yogeshbhai", "Milanbhai", "Jayantibhai", "Hardevsinh", "Mineshkumar", "Dipen", "Kishorbhai", "Dayalal", "Vedant", "Raj", "Swapnil", "Alpesh", "Ashok", "Bharat", "Chirag", "Dinesh"];
const LAST = ["Patel", "Prajapati", "Jadeja", "Desai", "Rabari", "Parmar", "Chaudhary", "Thakor", "Solanki", "Vyas"];
const CROPS = ["Marchi (Chilli)", "Cotton", "Groundnut", "Castor", "Wheat", "Cumin", "Mustard", "Sugarcane", "Potato", "Banana"];
const SOURCES = ["lead_named", "lead_coldcall", "sample_lead", "progressive_farmer", "institutional", "website", "referral"] as const;
const FOLLOW_UPS = ["not_contacted", "contacted", "interested", "not_interested", "converted"] as const;

/** Deterministic PRNG, so a seeded database is reproducible across runs. */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const rnd = makeRandom(20260831);
const pick = <T,>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)];
const chance = (p: number) => rnd() < p;
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export function buildContacts(total: number) {
  const docs = [];

  /*
    A long tail of leads against a smaller book of customers, which is the
    real shape — but with FLOORS, so every screen has something on it.

    The first cut used the true proportions (0.4% dealers, 3% customers) and
    a default seed of 500 produced two dealers and fifteen customers. Those
    screens then look broken rather than empty, and you cannot exercise
    pagination or search on fifteen rows. Sample data exists to test the UI,
    not to reproduce the ratios.
  */
  const dealerCount = Math.max(8, Math.round(total * 0.01));
  const customerCount = Math.max(30, Math.round(total * 0.06));

  for (let i = 0; i < total; i += 1) {
    const place = pick(PLACES);
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const isDealer = i < dealerCount;
    const isCustomer = !isDealer && i < dealerCount + customerCount;
    const kind = isDealer || isCustomer ? "customer" : "lead";

    const lastOrderDays = Math.floor(rnd() * 400);
    const orders = 1 + Math.floor(rnd() * 5);

    docs.push({
      contactId: isDealer
        ? `IKS-B-${String(i + 1).padStart(3, "0")}`
        : isCustomer
          ? `IKS-C-${String(i + 1).padStart(3, "0")}`
          : `IKS-L-${String(i + 1).padStart(4, "0")}`,
      kind,
      channel: isDealer ? "b2b" : isCustomer ? "b2c" : "",
      name,
      businessName: isDealer ? `${pick(LAST).toUpperCase()} ENTERPRISE` : "",
      // 9xxxxxxxxx, the Indian mobile shape, but never a real allocation:
      // the 5550 block is reserved for examples.
      phone: `9${String(5550000000 + i).slice(1)}`,
      village: pick(VILLAGES),
      taluka: pick(place.talukas),
      district: place.district,
      region: place.region,
      pin: `38${String(1000 + Math.floor(rnd() * 8999))}`,
      state: "Gujarat",
      crop: chance(0.7) ? pick(CROPS) : "",
      acres: chance(0.6) ? 1 + Math.floor(rnd() * 30) : null,
      source: pick(SOURCES),
      owner: chance(0.5) ? "Pranav" : "",
      lastContactAt: chance(0.5) ? daysAgo(Math.floor(rnd() * 90)) : null,
      // A third fall in the past, so the "due" view has something in it.
      followUpAt: chance(0.35) ? daysAgo(Math.floor(rnd() * 30) - 10) : null,
      lead:
        kind === "lead"
          ? {
              productsSampled: chance(0.4) ? "Both" : "",
              sampleDate: chance(0.3) ? daysAgo(Math.floor(rnd() * 200)) : null,
              feedbackCollected: chance(0.2),
              followUpStatus: pick(FOLLOW_UPS),
              nextAction: chance(0.4) ? "Call before kharif" : "",
            }
          : {},
      customer:
        kind === "customer"
          ? {
              subtype: isDealer ? "Distributor" : "Farmer",
              discountTier: "Standard",
              firstOrderAt: daysAgo(lastOrderDays + 60),
              lastOrderAt: daysAgo(lastOrderDays),
              lifetimeOrders: orders,
              // Integer paise, never rupees as a float.
              lifetimeRevenuePaise: orders * 120_015,
            }
          : {},
      dealer: isDealer
        ? {
            // Structurally valid but deliberately not a real GSTIN: 24 is
            // Gujarat, the PAN block is nonsense.
            gstin: `24AAAAA0000A1Z${i % 10}`,
            proprietor: `${pick(FIRST)} ${pick(LAST)}`,
            tier: "Distributor",
            territory: place.district,
            creditDays: 30,
            paymentTerms: "Advance / On Delivery",
          }
        : {},
      remarks: "",
      isSample: true,
    });
  }
  return docs;
}
