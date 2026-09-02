import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import {
  PurchaseForm,
  type PurchaseFormValues,
} from "@/components/admin/PurchaseForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { connectToDatabase } from "@/lib/db/connect";
import { Purchase } from "@/lib/db/models/Purchase";
import { paiseToRupeeString } from "@/lib/money";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Edit purchase" };
export const dynamic = "force-dynamic";

function toFormValues(doc: LeanDoc): PurchaseFormValues {
  // paiseToRupeeString, not String(paise / 100): the latter reads 105050
  // paise back as "1050.5" rather than "1050.50", on a money field.
  const money = (paise: unknown) =>
    typeof paise === "number" && paise !== 0 ? paiseToRupeeString(paise) : "";

  return {
    supplier: doc.supplier ?? "",
    supplierGstin: doc.supplierGstin ?? "",
    billNo: doc.billNo ?? "",
    // <input type="date"> needs yyyy-mm-dd, never a full ISO timestamp.
    billDate: doc.billDate ? new Date(doc.billDate).toISOString().slice(0, 10) : "",
    category: doc.category ?? "other",
    description: doc.description ?? "",
    taxableValue: money(doc.taxableValuePaise),
    cgst: money(doc.cgstPaise),
    sgst: money(doc.sgstPaise),
    igst: money(doc.igstPaise),
    total: money(doc.totalPaise),
    inputCreditEligible: Boolean(doc.inputCreditEligible),
    paidBy: doc.paidBy ?? "company",
    paidByName: doc.paidByName ?? "",
    paymentStatus: doc.paymentStatus ?? "unpaid",
    paid: money(doc.paidPaise),
    notes: doc.notes ?? "",
  };
}

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = (await Purchase.findById(id).lean()) as LeanDoc | null;
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref={`/admin/purchases/${id}`}
        backLabel={doc.supplier ?? "Purchases"}
        title={<>Bill from {doc.supplier}</>}
        description={doc.billNo || undefined}
      />
      <div className="mt-8">
        <PurchaseForm
          initial={toFormValues(doc)}
          purchaseId={id}
          /* Sent back on save, so an edit here cannot silently overwrite one
             made from another phone at the same moment. */
          version={typeof doc.__v === "number" ? doc.__v : 0}
        />
      </div>
    </>
  );
}
