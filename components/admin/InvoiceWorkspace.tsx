"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterTabs,
  ListPageSkeleton,
  Pagination,
  SearchInput,
  SelectField,
  StatusPill,
  TextField,
} from "./ui";
import { FormSheet } from "./FormSheet";
import {
  InvoiceForm,
  emptyInvoice,
  type InvoiceFormValues,
} from "./InvoiceForm";
import { formatINR } from "@/lib/money";
import { listQueryKey } from "@/lib/crm/scopes";
import type { BillableParty, BillableProduct } from "@/lib/admin/invoice-options";
import type { InvoiceList, InvoiceRow } from "@/lib/erp/list";

/**
 * The invoices screen.
 *
 * Deliberately the same shape as ContactWorkspace — list, URL-driven overlay,
 * server-rendered first page, first fetch skipped when the server already
 * answered. A second layout for the same job would be a second thing to keep
 * consistent.
 *
 * There is no EDIT. An issued invoice is a record of what was filed; the
 * model refuses a financial change regardless of what any screen asks for. The
 * only things a row offers are recording a payment, cancelling, and printing.
 */

const FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

export function InvoiceWorkspace({
  initialData,
  initialQuery,
  products,
  parties,
  canWrite,
  canCancel,
}: {
  initialData?: InvoiceList;
  initialQuery?: string;
  products: BillableProduct[];
  parties: BillableParty[];
  canWrite: boolean;
  canCancel: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [rows, setRows] = useState<InvoiceRow[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [pages, setPages] = useState(initialData?.pages ?? 1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [values, setValues] = useState<InvoiceFormValues>(emptyInvoice);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [paying, setPaying] = useState<InvoiceRow | null>(null);
  const [payment, setPayment] = useState({ status: "paid", paid: "", referenceNo: "" });
  const [cancelling, setCancelling] = useState<InvoiceRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const creating = params.get("new") === "1";

  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(() => {
    const q = new URLSearchParams({ page: String(page) });
    if (debounced) q.set("search", debounced);
    if (filter === "cancelled") q.set("status", "cancelled");
    else if (filter) q.set("payment", filter);
    return q;
  }, [page, debounced, filter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invoices?${query}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load invoices");
      setRows(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load invoices");
    } finally {
      setLoading(false);
    }
  }, [query]);

  // The server already answered the untouched first page — see ContactWorkspace.
  const alreadyServed = useRef(initialData ? initialQuery : null);
  useEffect(() => {
    if (alreadyServed.current === listQueryKey(query)) {
      alreadyServed.current = null;
      return;
    }
    void load();
  }, [load, query]);

  useEffect(() => {
    setPage(1);
  }, [debounced, filter]);

  const closeSheet = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("new");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (!creating) {
      setValues(emptyInvoice());
      setFieldErrors({});
      setDirty(false);
    }
  }, [creating]);

  async function issue() {
    setSaving(true);
    setFieldErrors({});
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: values.contactId,
          placeOfSupplyStateCode: values.placeOfSupplyStateCode,
          lines: values.lines.map((l) => ({
            productId: l.productId,
            packLabel: l.packLabel,
            quantity: Number(l.quantity) || 0,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
          transport: values.transport,
          transportCharged: values.transportCharged,
          notes: values.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setFieldErrors(data.fields);
        throw new Error(data.error ?? "Could not raise the invoice");
      }
      setDirty(false);
      closeSheet();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not raise the invoice");
    } finally {
      setSaving(false);
    }
  }

  async function savePayment() {
    if (!paying) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${paying.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: payment.status,
          paid: payment.paid,
          referenceNo: payment.referenceNo,
          paidAt: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not record the payment");
      setPaying(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the payment");
    } finally {
      setSaving(false);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${cancelling.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: cancelReason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not cancel");
      setCancelling(null);
      setCancelReason("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-ink-strong">
            Invoices
            <span className="ml-2 align-middle text-sm font-semibold text-ink-soft">
              {total}
            </span>
          </h1>
        </div>
        {canWrite && (
          <Button onClick={() => router.push(`${pathname}?new=1`, { scroll: false })}>
            Raise invoice
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search number or customer"
        />
        <FilterTabs value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <ListPageSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={debounced || filter ? "Nothing matches" : "No invoices yet"}
          message={
            debounced || filter
              ? "Try a different search or clear the filter."
              : "Raise the first one. Products need a GST rate and an HSN code first."
          }
        />
      ) : (
        <ul className="admin-rows grid gap-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="admin-card-item admin-bleed min-w-0 rounded-2xl border border-line-soft/60 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-bold text-ink-strong">
                    {row.number || "(no number)"}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-ink-muted">
                    {row.partyName}
                    {row.gstin ? ` · ${row.gstin}` : ""}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status={row.status} />
                    <StatusPill status={row.paymentStatus} />
                    {row.isHistorical && <StatusPill status="filed" />}
                    <span className="text-ink-faint">
                      {row.issuedAt
                        ? new Date(row.issuedAt).toLocaleDateString("en-IN")
                        : "not issued"}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-bold tabular-nums text-ink-strong">
                    {formatINR(row.grandTotalPaise)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap justify-end gap-1.5">
                    <Link
                      href={`/admin/invoices/${row.id}/print`}
                      className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                    >
                      Print
                    </Link>
                    {canWrite && !row.isHistorical && row.status === "issued" && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaying(row);
                          setPayment({
                            status: "paid",
                            paid: String(row.grandTotalPaise / 100),
                            referenceNo: "",
                          });
                        }}
                        className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                      >
                        Payment
                      </button>
                    )}
                    {canCancel && !row.isHistorical && row.status === "issued" && (
                      <button
                        type="button"
                        onClick={() => setCancelling(row)}
                        className="admin-tap inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-danger/12 hover:text-danger"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} pages={pages} onChange={setPage} />

      <FormSheet
        open={creating}
        title="Raise an invoice"
        description="The number is allocated when it is issued, so nothing is reserved until you save."
        busy={saving}
        dirty={dirty}
        onClose={closeSheet}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeSheet}>
              Cancel
            </Button>
            <Button onClick={issue} disabled={saving}>
              Issue invoice
            </Button>
          </div>
        }
      >
        <InvoiceForm
          values={values}
          onChange={(next) => {
            setValues(next);
            setDirty(true);
          }}
          products={products}
          parties={parties}
          errors={fieldErrors}
        />
      </FormSheet>

      <FormSheet
        open={Boolean(paying)}
        title={`Payment for ${paying?.number ?? ""}`}
        busy={saving}
        onClose={() => setPaying(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPaying(null)}>
              Cancel
            </Button>
            <Button onClick={savePayment} disabled={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <SelectField
            label="Status"
            value={payment.status}
            onChange={(status) => setPayment({ ...payment, status })}
            options={[
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Part paid" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <TextField
            label="Amount received ₹"
            type="number"
            value={payment.paid}
            onChange={(paid) => setPayment({ ...payment, paid })}
          />
          <TextField
            label="Reference"
            hint="UPI reference, cheque number, or how it arrived."
            value={payment.referenceNo}
            onChange={(referenceNo) => setPayment({ ...payment, referenceNo })}
          />
        </div>
      </FormSheet>

      {/*
        A sheet rather than a ConfirmDialog, because cancelling requires a
        reason — it goes in the audit log against the person's name, and a
        confirm dialog has nowhere to type one.
      */}
      <FormSheet
        open={Boolean(cancelling)}
        title={`Cancel ${cancelling?.number ?? ""}?`}
        description="It keeps its number and stays visible, marked cancelled. A gap in a GST series is something the department asks about."
        busy={saving}
        onClose={() => setCancelling(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button
              onClick={confirmCancel}
              disabled={saving || cancelReason.trim().length < 3}
            >
              Cancel invoice
            </Button>
          </div>
        }
      >
        <TextField
          label="Why"
          value={cancelReason}
          onChange={setCancelReason}
          hint="Recorded in the audit log against your name."
        />
      </FormSheet>

    </div>
  );
}
