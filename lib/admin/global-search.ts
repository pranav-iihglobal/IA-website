import { connectToDatabase } from "@/lib/db/connect";
import { DOCUMENT_LABELS, documentKind } from "@/lib/erp/document-kind";
import { Contact } from "@/lib/db/models/Contact";
import { Invoice } from "@/lib/db/models/Invoice";
import { Supplier } from "@/lib/db/models/Supplier";
import { buildFilter } from "@/lib/crm/filter";
import { buildInvoiceFilter } from "@/lib/erp/list";
import { joinPlace } from "@/lib/crm/shape";
import { searchRegex } from "@/lib/search";
import { can, type Access } from "@/lib/auth/permissions";
import { formatRupees } from "@/lib/money";
import { normaliseSearch, searchable } from "./search-query";
import type { LeanDoc } from "@/lib/db/lean";

/**
 * One search across everything the viewer may read.
 *
 * Each list had its own box, so "who is this number" meant guessing whether
 * they were a lead, a customer or a dealer before typing. This runs the same
 * filters the lists run — `buildFilter()` for contacts, `buildInvoiceFilter()`
 * for invoices — so a hit here is a row there, and adds suppliers by name,
 * GSTIN or town.
 *
 * Gated PER SECTION, not per request: the accountant, who has billing and no
 * CRM, gets invoices and suppliers and never sees a contact section, empty or
 * otherwise. A section the viewer cannot open is not in the response at all.
 */

export interface SearchHit {
  id: string;
  title: string;
  hint: string;
  href: string;
}

export interface SearchSection {
  key: "contacts" | "invoices" | "suppliers";
  label: string;
  hits: SearchHit[];
}

const PER_SECTION = 5;

function kindLabel(doc: LeanDoc): string {
  if (doc.kind === "lead") return "Lead";
  return doc.channel === "b2b" ? "Dealer" : "Customer";
}

async function contacts(q: string): Promise<SearchHit[]> {
  const docs = (await Contact.find(buildFilter(new URLSearchParams({ search: q })))
    .select("contactId kind channel name businessName phone village taluka district")
    .sort({ updatedAt: -1 })
    .limit(PER_SECTION)
    .lean()) as LeanDoc[];
  return docs.map((d) => ({
    id: String(d._id),
    title: d.businessName || d.name || "(unnamed)",
    hint: [kindLabel(d), d.contactId, d.phone, joinPlace(d.village, d.district)]
      .filter(Boolean)
      .join(" · "),
    href: `/admin/contacts/${String(d._id)}`,
  }));
}

async function invoices(q: string): Promise<SearchHit[]> {
  const docs = (await Invoice.find(buildInvoiceFilter(new URLSearchParams({ search: q })))
    .select("number documentType party grandTotalPaise payment status")
    .sort({ issuedAt: -1 })
    .limit(PER_SECTION)
    .lean()) as LeanDoc[];
  return docs.map((d) => ({
    id: String(d._id),
    title: d.number || "(draft)",
    hint: [
      DOCUMENT_LABELS[documentKind(d)],
      d.party?.businessName || d.party?.name,
      formatRupees(d.grandTotalPaise ?? 0),
      d.status === "cancelled" ? "cancelled" : d.payment?.status,
    ]
      .filter(Boolean)
      .join(" · "),
    href: `/admin/invoices/${String(d._id)}`,
  }));
}

async function suppliers(q: string): Promise<SearchHit[]> {
  const rx = searchRegex(q);
  const docs = (await Supplier.find({ $or: [{ name: rx }, { gstin: rx }, { city: rx }] })
    .select("name gstin city")
    .sort({ name: 1 })
    .limit(PER_SECTION)
    .lean()) as LeanDoc[];
  return docs.map((d) => ({
    id: String(d._id),
    title: d.name || "(unnamed)",
    hint: ["Supplier", d.gstin, d.city].filter(Boolean).join(" · "),
    href: `/admin/suppliers/${String(d._id)}`,
  }));
}

export async function globalSearch(raw: string, access: Access): Promise<SearchSection[]> {
  if (!searchable(raw)) return [];
  const q = normaliseSearch(raw);
  await connectToDatabase();

  const wanted: { key: SearchSection["key"]; label: string; allowed: boolean; run: () => Promise<SearchHit[]> }[] = [
    { key: "contacts", label: "Contacts", allowed: can(access, "crm:read"), run: () => contacts(q) },
    { key: "invoices", label: "Invoices", allowed: can(access, "billing:read"), run: () => invoices(q) },
    { key: "suppliers", label: "Suppliers", allowed: can(access, "billing:read"), run: () => suppliers(q) },
  ];
  const allowed = wanted.filter((w) => w.allowed);
  const results = await Promise.all(allowed.map((w) => w.run()));
  return allowed
    .map((w, i) => ({ key: w.key, label: w.label, hits: results[i] }))
    .filter((s) => s.hits.length > 0);
}
