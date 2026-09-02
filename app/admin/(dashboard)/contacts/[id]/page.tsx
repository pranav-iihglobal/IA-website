import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ContactProfile, type ProfileContact } from "@/components/admin/ContactProfile";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { can } from "@/lib/auth/permissions";
import { getContactProfile, sampledOutcome } from "@/lib/crm/profile";
import { joinPlace } from "@/lib/crm/shape";
import { scopeFor } from "@/lib/crm/scopes";
import { getProductOptions } from "@/lib/admin/products-options";
import { recordHistory } from "@/lib/admin/history";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

/**
 * One contact — customers, dealers and leads alike.
 *
 * ONE route rather than three, because it is one collection filtered three
 * ways. ContactWorkspace is already one component with a `scope` for the same
 * reason; three near-identical profile pages would drift apart exactly as
 * B2C_Master and B2B_Master did.
 */
export default async function ContactProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePageAccess("crm:read");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  const [data, productOptions, history] = await Promise.all([
    getContactProfile(id),
    getProductOptions(),
    // What was CHANGED, as against the call log's what was DISCUSSED.
    recordHistory("Contact", id),
  ]);
  if (!data) notFound();

  const c = data.contact;
  const scope = scopeFor(c.kind ?? "lead", c.channel ?? "");

  const contact: ProfileContact = {
    id,
    // Sent back on save, so an edit here cannot silently overwrite one made
    // from the list at the same moment.
    version: typeof c.__v === "number" ? c.__v : 0,
    contactId: c.contactId ?? "",
    kind: c.kind ?? "lead",
    channel: c.channel ?? "",
    name: c.name ?? "",
    nameGu: c.nameGu ?? "",
    businessName: c.businessName ?? "",
    phone: c.phone ?? "",
    altPhone: c.altPhone ?? "",
    email: c.email ?? "",
    place: joinPlace(c.village, c.taluka),
    district: c.district ?? "",
    region: c.region ?? "",
    crop: c.crop ?? "",
    acres: c.acres ?? null,
    source: c.source ?? "",
    owner: c.owner ?? "",
    remarks: c.remarks ?? "",
    followUpAt: c.followUpAt ? new Date(c.followUpAt).toISOString() : null,
    lastContactAt: c.lastContactAt ? new Date(c.lastContactAt).toISOString() : null,
    nextAction: c.lead?.nextAction ?? "",
    storedOrders: c.customer?.lifetimeOrders ?? 0,
    storedRevenuePaise: c.customer?.lifetimeRevenuePaise ?? 0,
    discountTier: c.customer?.discountTier ?? "",
    subtype: c.customer?.subtype ?? "",
    dealer: {
      gstin: c.dealer?.gstin ?? "",
      proprietor: c.dealer?.proprietor ?? "",
      tier: c.dealer?.tier ?? "",
      territory: c.dealer?.territory ?? "",
      creditLimitPaise: c.dealer?.creditLimitPaise ?? 0,
      creditDays: c.dealer?.creditDays ?? 0,
      paymentTerms: c.dealer?.paymentTerms ?? "",
      nextVisitAt: c.dealer?.nextVisitAt
        ? new Date(c.dealer.nextVisitAt).toISOString()
        : null,
    },
    isSample: Boolean(c.isSample),
  };

  const notes = (c.notes ?? []).map((n: LeanDoc) => ({
    id: String(n._id),
    body: n.body ?? "",
    author: n.author ?? "",
    at: n.at ? new Date(n.at).toISOString() : new Date().toISOString(),
  }));

  /*
    What was sampled, and whether they then bought it — the loop the sampling
    programme exists to close, and which could not be closed while the
    sampled products were a sentence.

    Names come from the catalogue the page already loaded, so a product
    renamed since the sample was given reads as its current self. A reference
    to a product that has since been DELETED is dropped rather than shown as
    a blank row; the original free text is still on the record beneath it.
  */
  const productNames = new Map(productOptions.map((p) => [p.id, p.name]));
  const sampled = (c.lead?.productIds ?? [])
    .map((id: unknown) => String(id))
    .filter((id: string) => productNames.has(id))
    .map((id: string) => ({ id, name: productNames.get(id)! }));

  const sampling = {
    products: sampledOutcome(
      sampled,
      // Cancelled invoices count for nothing here either — summariseTrading
      // takes the same view, and the two must not disagree on one screen.
      data.invoices.filter((i) => i.status !== "cancelled").flatMap((i) => i.lines),
    ),
    /** Kept and shown: it is what was actually written down at the time. */
    note: c.lead?.productsSampled ?? "",
    sampleDate: c.lead?.sampleDate
      ? new Date(c.lead.sampleDate).toISOString()
      : null,
    quantity: c.lead?.sampleQuantity ?? "",
    feedbackCollected: Boolean(c.lead?.feedbackCollected),
    feedbackNotes: c.lead?.feedbackNotes ?? "",
  };

  const backLabel =
    scope === "leads" ? "Leads" : scope === "dealers" ? "Dealers" : "Customers";

  return (
    <ContactProfile
      contact={contact}
      invoices={data.invoices}
      trading={data.trading}
      sampling={sampling}
      notes={notes}
      history={history}
      canEdit={can(me, "crm:write")}
      /* billing:read, deliberately separate from crm:read. */
      canSeeMoney={can(me, "billing:read")}
      /*
        A sample contact is excluded for the same reason the invoice party
        picker excludes them: a real invoice raised against a seeded person
        looks perfectly correct right up until the wipe deletes them.
      */
      canBill={
        can(me, "billing:write") && contact.kind === "customer" && !contact.isSample
      }
      backHref={`/admin/${scope}`}
      backLabel={backLabel}
    />
  );
}
