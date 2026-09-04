import { telHref, whatsappHref } from "@/lib/crm/contact-links";

/**
 * The two taps a money screen exists for: ring them, or send the reminder.
 *
 * A list of who owes money with no way to reach any of them is a report
 * rather than a tool. Both pills are hidden rather than disabled when the
 * stored number is not one this can be confident about — a dead "Call"
 * button is worse than none. Server-safe: plain links, no hooks.
 */
export function ReachPills({
  name,
  phone,
  message,
  compact = false,
}: {
  name: string;
  phone: string;
  /** The WhatsApp text, already written for this person and this debt. */
  message: string;
  /** Shorter labels for a card footer. */
  compact?: boolean;
}) {
  const tel = telHref(phone);
  const chat = whatsappHref(phone, message);
  if (!tel && !chat) return null;

  const pill =
    "admin-tap inline-flex items-center rounded-full border border-line px-3.5 text-xs font-semibold text-ink hover:border-olive";
  return (
    <>
      {tel && (
        <a href={tel} aria-label={`Call ${name} on ${phone}`} className={pill}>
          Call
        </a>
      )}
      {chat && (
        <a
          href={chat}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${name} a reminder`}
          className={pill}
        >
          {compact ? "WhatsApp" : "WhatsApp reminder"}
        </a>
      )}
    </>
  );
}
