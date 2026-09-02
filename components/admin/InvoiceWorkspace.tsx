"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BetaStar,
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
import { useToast } from "./Toast";
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
 * only things a row offers are recording a payment, cancelling, crediting, and
 * printing.
 *
 * Cancelling and crediting are not the same act and the screen does not blur
 * them. Cancel voids the whole document; a credit note leaves it standing and
 * reverses part of it, which is what a correction to something already filed
 * has to look like.
 */

const FILTERS = [
  { value: "", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
  { value: "credit_notes", label: "Credit notes" },
];

const isCredit = (row: InvoiceRow) => row.documentType === "credit_note";

/** One line of the invoice being credited, as the sheet edits it. */
interface CreditLine {
  index: number;
  description: string;
  packLabel: string;
  /** What was invoiced. The ceiling for what can be credited. */
  invoiced: number;
  /** What is being credited now, as typed. */
  quantity: string;
}

export function InvoiceWorkspace({
  initialData,
  initialQuery,
  products,
  parties,
  canWrite,
  canCancel,
  /** The module's beta note, if it has one. Renders a star beside the title. */
  beta,
}: {
  initialData?: InvoiceList;
  initialQuery?: string;
  products: BillableProduct[];
  parties: BillableParty[];
  canWrite: boolean;
  canCancel: boolean;
  beta?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { toast } = useToast();

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

  const [crediting, setCrediting] = useState<InvoiceRow | null>(null);
  const [creditReason, setCreditReason] = useState("");
  const [creditLines, setCreditLines] = useState<CreditLine[] | null>(null);

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
    else if (filter === "credit_notes") q.set("kind", "credit_note");
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
      /*
        The number is the whole point. It is allocated at issue, printed on the
        document and filed — and until now this threw it away and closed the
        sheet in silence, so the only way to know an invoice existed was to
        find it in the list.
      */
      toast(`Invoice ${data.number} issued`, "success", {
        action: {
          label: "Print",
          onClick: () => router.push(`/admin/invoices/${data.id}/print`),
        },
      });
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not raise the invoice";
      setError(message);
      toast(message, "error");
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
      toast(`Payment recorded against ${paying.number}`);
      setPaying(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not record the payment";
      setError(message);
      toast(message, "error");
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
      // Says it kept its number, because that is the part people doubt.
      toast(`${cancelling.number} cancelled — it keeps its number`);
      setCancelling(null);
      setCancelReason("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not cancel";
      setError(message);
      toast(message, "error");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Open the credit sheet, having fetched the invoice's lines.
   *
   * The list row does not carry them, and a partial credit is meaningless
   * without them — "credit 3 of the 10 sachets" needs to know there were ten.
   * Fetched on open rather than shipped with every row, because this is one
   * invoice out of a page of twenty-five.
   */
  async function openCredit(row: InvoiceRow) {
    setCrediting(row);
    setCreditReason("");
    setCreditLines(null);
    try {
      const res = await fetch(`/api/admin/invoices/${row.id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not read that invoice");
      setCreditLines(
        (data.lines ?? []).map(
          (l: { description?: string; packLabel?: string; quantity?: number }, index: number) => ({
            index,
            description: l.description ?? "",
            packLabel: l.packLabel ?? "",
            invoiced: l.quantity ?? 0,
            // Defaulted to the whole line: a full reversal is the common case.
            quantity: String(l.quantity ?? 0),
          }),
        ),
      );
    } catch (e) {
      setCrediting(null);
      setError(e instanceof Error ? e.message : "Could not read that invoice");
    }
  }

  async function confirmCredit() {
    if (!crediting || !creditLines) return;
    setSaving(true);
    try {
      /*
        Lines are sent only when this is a PARTIAL credit. Sending every line
        at its full quantity would be the same thing, but omitting them lets
        the server work out what is LEFT — which is the right answer when an
        earlier note already took some of it.
      */
      const picked = creditLines
        .map((l) => ({ index: l.index, quantity: Number(l.quantity) || 0 }))
        .filter((l) => l.quantity > 0);
      const whole =
        picked.length === creditLines.length &&
        picked.every((l) => l.quantity === creditLines[l.index].invoiced);

      const res = await fetch(`/api/admin/invoices/${crediting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "credit",
          reason: creditReason,
          ...(whole ? {} : { lines: picked }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not raise the credit note");
      const against = crediting.number;
      toast(`Credit note ${data.number} raised against ${against}`, "success", {
        action: {
          label: "Print",
          onClick: () => router.push(`/admin/invoices/${data.id}/print`),
        },
      });
      setCrediting(null);
      setCreditLines(null);
      setCreditReason("");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not raise the credit note";
      setError(message);
      toast(message, "error");
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
            {/* Same star as the sidebar, so the two say one thing. */}
            {beta && (
              <BetaStar note={beta} className="ml-1.5 align-middle text-base text-alloy" />
            )}
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
                  {isCredit(row) && row.againstNumber && (
                    <p className="mt-0.5 text-xs text-ink-faint">
                      credits {row.againstNumber}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {isCredit(row) ? (
                      <StatusPill status="credit note" />
                    ) : (
                      <>
                        <StatusPill status={row.status} />
                        <StatusPill status={row.paymentStatus} />
                      </>
                    )}
                    {isCredit(row) && row.status === "cancelled" && (
                      <StatusPill status="cancelled" />
                    )}
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
                    {canWrite && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
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
                    {canWrite && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
                      <button
                        type="button"
                        onClick={() => void openCredit(row)}
                        className="admin-tap inline-flex items-center rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted hover:border-olive"
                      >
                        Credit
                      </button>
                    )}
                    {canCancel && !row.isHistorical && !isCredit(row) && row.status === "issued" && (
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
        onSubmit={issue}
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
        dirty={payment.paid !== "" || payment.referenceNo !== ""}
        onClose={() => setPaying(null)}
        onSubmit={savePayment}
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
            label="Amount received"
            kind="money"
            prefix="₹"
            value={payment.paid}
            onChange={(paid) => setPayment({ ...payment, paid })}
          />
          <TextField
            label="Reference"
            kind="code"
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
        dirty={cancelReason.trim().length > 0}
        onClose={() => setCancelling(null)}
        onSubmit={() => {
          // Enter must respect the same rule the button does.
          if (cancelReason.trim().length >= 3) void confirmCancel();
        }}
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

      {/*
        Crediting. The quantities default to the whole invoice, so the common
        case is type a reason and save; changing one to a smaller number makes
        it a partial credit. Nothing here can be raised above what was
        invoiced, and the server checks it again against any earlier note.
      */}
      <FormSheet
        open={Boolean(crediting)}
        title={`Credit note against ${crediting?.number ?? ""}`}
        description="The invoice stays as it is. This raises a separate document that reverses part of it, with its own CN number."
        busy={saving}
        dirty={creditReason.trim().length > 0}
        onClose={() => {
          setCrediting(null);
          setCreditLines(null);
        }}
        onSubmit={() => {
          if (creditReason.trim().length >= 3 && creditLines) void confirmCredit();
        }}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCrediting(null);
                setCreditLines(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCredit}
              disabled={
                saving ||
                !creditLines ||
                creditReason.trim().length < 3 ||
                creditLines.every((l) => (Number(l.quantity) || 0) <= 0)
              }
            >
              Raise credit note
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Reason"
            value={creditReason}
            onChange={setCreditReason}
            hint="Printed on the note and filed with the return — short delivery, goods returned, price corrected."
          />

          {!creditLines ? (
            <p className="text-sm text-ink-faint">Reading the invoice…</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                What to credit
              </p>
              {creditLines.map((line, i) => (
                <div
                  key={line.index}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-line-soft/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-strong">
                      {line.description}
                    </p>
                    <p className="text-xs text-ink-faint">{line.invoiced} invoiced</p>
                  </div>
                  <div className="w-28">
                    <TextField
                      label="Credit"
                      kind="quantity"
                      value={line.quantity}
                      onChange={(quantity) =>
                        setCreditLines(
                          creditLines.map((l, j) => (i === j ? { ...l, quantity } : l)),
                        )
                      }
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-ink-faint">
                Set a line to 0 to leave it alone. A credit note cannot reverse more
                than was invoiced, or more than is left after an earlier one.
              </p>
            </div>
          )}
        </div>
      </FormSheet>
    </div>
  );
}
