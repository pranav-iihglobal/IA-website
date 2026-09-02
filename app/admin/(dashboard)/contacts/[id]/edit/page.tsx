import { notFound } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { ContactForm } from "@/components/admin/ContactForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { connectToDatabase } from "@/lib/db/connect";
import { Contact } from "@/lib/db/models/Contact";
import { getProductOptions } from "@/lib/admin/products-options";
import { toContactFormValues } from "@/lib/crm/form";
import { scopeFor } from "@/lib/crm/scopes";
import type { LeanDoc } from "@/lib/db/lean";

export const metadata = { title: "Edit contact" };
export const dynamic = "force-dynamic";

/**
 * Editing one contact — customers, dealers and leads alike.
 *
 * ONE route rather than three, for the same reason the profile beside it is
 * one route: it is one collection filtered three ways. The scope is DERIVED
 * from the record, never carried in the URL, so a link cannot claim the wrong
 * kind and get a form that does not match what is stored.
 */
export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAccess("crm:write");

  const { id } = await params;
  if (!isValidObjectId(id)) notFound();

  await connectToDatabase();
  const [doc, products] = await Promise.all([
    Contact.findById(id).lean(),
    getProductOptions(),
  ]);
  if (!doc) notFound();

  const contact = doc as LeanDoc;
  const scope = scopeFor(contact.kind ?? "lead", contact.channel ?? "");
  const title = contact.businessName || contact.name || "this contact";

  return (
    <>
      <FormPageHeader
        /* Back to the record, not the list: this page is opened from the
           profile, and that is where saving returns to as well. */
        backHref={`/admin/contacts/${id}`}
        backLabel={title}
        title={<>Edit {title}</>}
        description={contact.contactId || undefined}
      />
      <div className="mt-8">
        <ContactForm
          scope={scope}
          contactId={id}
          /* Sent back on save, so an edit here cannot silently overwrite one
             made from another phone at the same moment. */
          version={typeof contact.__v === "number" ? contact.__v : 0}
          initial={toContactFormValues(contact)}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
        />
      </div>
    </>
  );
}
