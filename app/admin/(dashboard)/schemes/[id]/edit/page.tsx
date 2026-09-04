import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { SchemeForm, type SchemeFormValues } from "@/components/admin/SchemeForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { getProductOptions } from "@/lib/admin/products-options";
import { connectToDatabase } from "@/lib/db/connect";
import { Scheme } from "@/lib/db/models/Scheme";
import { paiseToRupeeString } from "@/lib/money";
import { istDateTimeInputValue } from "@/lib/time";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Edit scheme" };
export const dynamic = "force-dynamic";

function toFormValues(doc: LeanDoc): SchemeFormValues {
  const percent = doc.discountType !== "flat";
  return {
    name: doc.name ?? "",
    discountType: percent ? "percent" : "flat",
    // Basis points back to a percentage; paise back to rupees, two places.
    discount: percent
      ? String((doc.discountValue ?? 0) / 100)
      : paiseToRupeeString(doc.discountValue ?? 0),
    productIds: ((doc.productIds ?? []) as unknown[]).map(String),
    channel: doc.channel === "b2c" || doc.channel === "b2b" ? doc.channel : "both",
    startAt: doc.startAt ? istDateTimeInputValue(new Date(doc.startAt)) : "",
    endAt: doc.endAt ? istDateTimeInputValue(new Date(doc.endAt)) : "",
    enabled: doc.enabled !== false,
    notes: doc.notes ?? "",
  };
}

export default async function EditSchemePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, products] = await Promise.all([
    Scheme.findById(id).lean() as Promise<LeanDoc | null>,
    getProductOptions(),
  ]);
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref="/admin/schemes"
        backLabel="Schemes"
        title={<>Edit {doc.name}</>}
        description="Invoices already issued under this scheme keep the discount they were issued with."
      />
      <div className="mt-8">
        <SchemeForm
          initial={toFormValues(doc)}
          schemeId={id}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
          version={typeof doc.__v === "number" ? doc.__v : 0}
        />
      </div>
    </>
  );
}
