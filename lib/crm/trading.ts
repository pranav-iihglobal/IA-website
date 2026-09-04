import { Contact } from "@/lib/db/models/Contact";
import { recordAudit } from "@/lib/db/models/AuditLog";
import { allocateContactId, conversionOnFirstOrder } from "./contact-id";

/**
 * What an invoice does to the customer record behind it.
 *
 * `customer.lastOrderAt`, `lifetimeOrders` and `lifetimeRevenuePaise` were
 * declared, validated, indexed, sorted on and read by the list — and written
 * by NOTHING except the seed script and a form round-trip. So the list said
 * "Prospect, no orders" about a farmer whose profile, deriving the same
 * figures from invoices, said "Active, 4 orders". Two screens disagreeing
 * about one customer. This is the writer that was missing.
 *
 * Additive on purpose: the sheet-imported figures stay in, and every invoice
 * raised here adds to them. The profile still derives its own view from the
 * invoices; the stored figures are what the list sorts and filters on.
 *
 * This is also the moment a sample-stage contact becomes a customer — their
 * first real invoice — see convertOnFirstOrder().
 */

export interface TradingDelta {
  /** +1 for an invoice issued, −1 for one cancelled; a credit note is not an order. */
  orders: number;
  /** Signed paise. A credit note's grand total is already negative. */
  revenuePaise: number;
}

/**
 * The delta a document applies, or undoes.
 *
 * Only invoices count as orders. Credit notes move money, not orders. A
 * sample note (Phase 13.8) is neither — nothing was bought.
 */
export function tradingDelta(
  doc: { documentType?: string; grandTotalPaise?: number },
  direction: "apply" | "undo",
): TradingDelta {
  const sign = direction === "apply" ? 1 : -1;
  const type = doc.documentType ?? "invoice";
  if (type === "sample_note") return { orders: 0, revenuePaise: 0 };
  const paise = doc.grandTotalPaise ?? 0;
  if (type === "credit_note") return { orders: 0, revenuePaise: sign * paise };
  return { orders: sign, revenuePaise: sign * paise };
}

/** Write a delta onto the contact. `at` moves lastOrderAt forward, never back. */
export async function applyTradingDelta(
  contactId: unknown,
  delta: TradingDelta,
  at?: Date,
): Promise<void> {
  if (!contactId) return;
  if (delta.orders === 0 && delta.revenuePaise === 0 && !at) return;
  await Contact.updateOne(
    { _id: contactId },
    {
      $inc: {
        "customer.lifetimeOrders": delta.orders,
        "customer.lifetimeRevenuePaise": delta.revenuePaise,
      },
      ...(at && delta.orders > 0 ? { $max: { "customer.lastOrderAt": at } } : {}),
    },
  );
  if (at && delta.orders > 0) {
    // The first order stays the first: set only where nothing is set.
    await Contact.updateOne(
      { _id: contactId, "customer.firstOrderAt": null },
      { $set: { "customer.firstOrderAt": at } },
    );
  }
}

/**
 * A sample-stage contact's first real order makes them a customer.
 *
 * A new id in the IKS series, the SMP id kept as a former id (it is on the
 * sample register), kind and channel settled, and an audit entry naming the
 * invoice that did it. Called AFTER the invoice exists — a conversion for an
 * invoice that failed to write would be a lie about the record.
 */
export async function convertOnFirstOrder(
  contactId: unknown,
  actor: string,
  invoiceNumber: string,
): Promise<string | null> {
  if (!contactId) return null;
  const contact = await Contact.findById(contactId)
    .select("kind channel stage contactId formerIds")
    .lean();
  if (!contact) return null;
  const patch = conversionOnFirstOrder({
    kind: contact.kind ?? "lead",
    channel: contact.channel ?? "",
    stage: contact.stage ?? "customer",
  });
  if (!patch) return null;

  const previousId = contact.contactId ?? "";
  const newId = await allocateContactId(patch.kind, patch.channel, patch.stage);
  await Contact.updateOne(
    { _id: contactId },
    {
      $set: { ...patch, contactId: newId },
      ...(previousId ? { $addToSet: { formerIds: previousId } } : {}),
    },
  );
  await recordAudit({
    actor,
    action: "update",
    entity: "Contact",
    entityId: String(contactId),
    before: { contactId: previousId, stage: "sample", kind: contact.kind, channel: contact.channel },
    after: { contactId: newId, stage: patch.stage, kind: patch.kind, channel: patch.channel },
    note: `Became a customer on ${invoiceNumber}`,
  });
  return newId;
}
