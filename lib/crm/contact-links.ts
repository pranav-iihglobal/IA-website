/**
 * Reaching a customer from their record.
 *
 * There was not one `tel:` link in the whole admin — a CRM holding 5,118 phone
 * numbers, used on a phone in a field, where you could not tap a number to
 * ring it. And `lib/content.ts` has built wa.me links since the site was
 * written, but only INBOUND: customer → IKSARVA. The direction the CRM needs
 * did not exist.
 *
 * No API, no cost, no Meta business verification — these are just links. That
 * matters: capturing WhatsApp conversations properly needs the Business
 * Platform and is its own project, but opening a chat with the right number
 * and the right message already prefilled is a URL.
 */

/**
 * Strip a stored number back to digits and add the country code.
 *
 * Numbers arrive in every shape the sheets carry — "+91 98250 12345",
 * "098250 12345", "9825012345". `phoneSchema` normalises on save, but records
 * imported or written before it still hold the original, so this cannot assume
 * a clean value.
 */
export function dialable(phone: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // Already carries 91, and is the right length for it.
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  // A leading 0 is a domestic trunk prefix, not part of the number.
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 10) return `91${digits}`;

  // Anything else is not a number this can be confident about. Better to
  // offer no link than one that dials something wrong.
  return null;
}

/** `tel:` for the number as stored — the dialler is happy with punctuation. */
export function telHref(phone: string): string | null {
  const number = dialable(phone);
  return number ? `tel:+${number}` : null;
}

/** A WhatsApp chat, optionally with the first message already written. */
export function whatsappHref(phone: string, message?: string): string | null {
  const number = dialable(phone);
  if (!number) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${number}${query}`;
}

/**
 * The message for chasing an unpaid invoice.
 *
 * Written to be sent as-is by someone who is busy: it names the invoice and
 * the amount, because "you owe us money" prompts a phone call back asking
 * which one. Deliberately not chatty and deliberately not threatening — this
 * goes to a farmer the business wants to sell to again.
 */
export function paymentReminder({
  name,
  number,
  amount,
}: {
  name: string;
  number: string;
  amount: string;
}): string {
  return (
    `Namaste ${name}, this is IKSARVA Agritech. ` +
    `A gentle reminder about invoice ${number} for ${amount}. ` +
    `Please let us know if you need the bill again. Thank you.`
  );
}
