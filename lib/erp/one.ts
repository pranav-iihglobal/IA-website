import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * One invoice, for the three pages that act on it.
 *
 * WHY THIS EXISTS AT ALL. These three acts used to be dialogs opened from a
 * row, and which rows offered which button WAS the guard:
 *
 *     canWrite && !row.isHistorical && !isCredit(row) && row.status === "issued"
 *
 * Turning them into pages made every one of them an addressable URL, and a URL
 * is reachable by anybody who can type one — from a bookmark, from the browser
 * history, from a link somebody pastes into WhatsApp. A condition in JSX stops
 * a button rendering; it does not stop a request. So the conditions had to move
 * somewhere a URL passes through, and this is it.
 *
 * The API is still the real guard, and mostly already was. The one place it was
 * not is named below.
 */

export interface InvoiceActionOptions {
  /**
   * Whether this act makes sense on a credit note.
   *
   * Cancelling one does: a note raised in error has to be voidable, the
   * engine supports it, and creditedSoFar() only counts ISSUED notes, so
   * cancelling one correctly releases its quantities back to the invoice.
   *
   * Paying one does not. A credit note is money going the other way and is
   * written `payment: paid` at issue; "recording a payment" against it would
   * overwrite that on a filed document with a figure that means nothing.
   *
   * Crediting one does not either — issueCreditNote() refuses it in so many
   * words — so the form should never appear rather than being filled in and
   * then rejected.
   */
  allowCreditNote?: boolean;
}

export async function invoiceForActionOr404(
  id: string,
  { allowCreditNote = false }: InvoiceActionOptions = {},
): Promise<LeanDoc> {
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = (await Invoice.findById(id).lean()) as LeanDoc | null;
  if (!doc) notFound();

  /*
    A historical invoice is a record of what was filed before this system
    existed. It is read-only by decision, not by accident — see the import
    rule in the plan.
  */
  if (doc.status !== "issued" || doc.isHistorical) notFound();
  if (doc.documentType === "credit_note" && !allowCreditNote) notFound();

  return doc;
}
