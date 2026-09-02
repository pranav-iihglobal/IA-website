import { ContactForm, emptyContact } from "@/components/admin/ContactForm";
import { FormPageHeader } from "@/components/admin/ui";
import { requirePageAccess } from "@/lib/admin/page-guard";
import { getProductOptions } from "@/lib/admin/products-options";
import type { Scope } from "@/lib/crm/scopes";

/**
 * "Add a customer / dealer / lead", shared by the three routes.
 *
 * One component rather than three near-identical pages, for the same reason
 * the three lists are one workspace and the profile is one route: they are
 * one collection filtered three ways, and three copies drift exactly as
 * B2C_Master and B2B_Master did.
 *
 * A server component, so the permission check and the catalogue lookup happen
 * before anything reaches the browser.
 */

const NOUN: Record<Scope, { title: string; back: string }> = {
  customers: { title: "New customer", back: "Customers" },
  dealers: { title: "New dealer", back: "Dealers" },
  leads: { title: "New lead", back: "Leads" },
};

/** What a record created on each screen has to be, to land in that list. */
const DEFAULTS: Record<Scope, Partial<ReturnType<typeof emptyContact>>> = {
  customers: { kind: "customer", channel: "b2c" },
  dealers: { kind: "customer", channel: "b2b" },
  leads: { kind: "lead" },
};

export async function NewContactPage({ scope }: { scope: Scope }) {
  await requirePageAccess("crm:write");
  // The catalogue, for the sampled-products picker on the lead form.
  const products = await getProductOptions();
  const { title, back } = NOUN[scope];

  return (
    <>
      <FormPageHeader
        backHref={`/admin/${scope}`}
        backLabel={back}
        title={title}
      />
      <div className="mt-8">
        <ContactForm
          scope={scope}
          initial={{ ...emptyContact(), ...DEFAULTS[scope] }}
          products={products.map((p) => ({ id: p.id, label: p.name, hint: p.hint }))}
        />
      </div>
    </>
  );
}
