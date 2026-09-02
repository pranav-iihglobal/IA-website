import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Invoice } from "@/lib/db/models/Invoice";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * One invoice, for the three pages that act on it.
 *
 * Shared so payment, cancel and credit-note all agree on WHICH invoices can be
 * acted on. Every one of them is only valid against an issued invoice: a draft
 * has nothing to pay, and a cancelled document is finished. The API refuses
 * the rest anyway — that is the real guard — but discovering it after filling
 * a form in is a poor way to find out.
 */
export async function issuedInvoiceOr404(id: string): Promise<LeanDoc> {
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

  return doc;
}
