import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { SupplierForm, type SupplierFormValues } from "@/components/admin/SupplierForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { connectToDatabase } from "@/lib/db/connect";
import { Supplier } from "@/lib/db/models/Supplier";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Edit supplier" };
export const dynamic = "force-dynamic";

function toFormValues(doc: LeanDoc): SupplierFormValues {
  return {
    name: doc.name ?? "",
    gstin: doc.gstin ?? "",
    phone: doc.phone ?? "",
    email: doc.email ?? "",
    address: doc.address ?? "",
    city: doc.city ?? "",
    state: doc.state ?? "Gujarat",
    notes: doc.notes ?? "",
  };
}

export default async function EditSupplierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("billing:write");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const doc = (await Supplier.findById(id).lean()) as LeanDoc | null;
  if (!doc) notFound();

  return (
    <>
      <FormPageHeader
        backHref={`/admin/suppliers/${id}`}
        backLabel={doc.name ?? "Suppliers"}
        title={<>Edit {doc.name}</>}
        description="Bills already entered keep the name and GSTIN they were entered with."
      />
      <div className="mt-8">
        <SupplierForm
          initial={toFormValues(doc)}
          supplierId={id}
          version={typeof doc.__v === "number" ? doc.__v : 0}
        />
      </div>
    </>
  );
}
