import { describe, expect, it } from "vitest";
import { mergeTimeline } from "./timeline";
import type { HistoryEntry } from "@/lib/admin/history";
import type { ProfileInvoice } from "./profile";

const change = (id: string, at: string, action = "update"): HistoryEntry => ({
  id,
  actor: "a@example.com",
  action,
  entity: "Contact",
  entityId: "c1",
  summary: "",
  at,
  note: "",
  changes: [],
});
const invoice = (id: string, issuedAt: string, documentType = "invoice"): ProfileInvoice => ({
  id,
  number: id,
  documentType,
  againstNumber: "",
  issuedAt,
  status: "issued",
  grandTotalPaise: 1000,
  paidPaise: 0,
  paymentStatus: "unpaid",
  isHistorical: false,
  lines: [],
});

describe("mergeTimeline", () => {
  it("interleaves calls, changes and invoices newest first", () => {
    const out = mergeTimeline({
      notes: [{ _id: "n1", body: "Called", at: "2026-06-10T06:00:00.000Z" }],
      history: [change("h1", "2026-05-01T06:00:00.000Z")],
      invoices: [invoice("IA.07.26.001", "2026-07-15T06:00:00.000Z")],
    });
    expect(out.map((e) => e.kind)).toEqual(["invoice", "note", "change"]);
  });

  it("puts a credit note after the invoice it reverses when both carry the same instant", () => {
    const t = "2026-07-15T06:00:00.000Z";
    const out = mergeTimeline({
      notes: [],
      history: [],
      invoices: [invoice("IA.07.26.001", t), invoice("CN.07.26.001", t, "credit_note")],
    });
    // Newest first, so the credit note — the later event — is on top.
    expect(out.map((e) => e.kind)).toEqual(["credit_note", "invoice"]);
  });

  it("drops the audit line for a logged call, which is already there as the call", () => {
    const out = mergeTimeline({
      notes: [{ _id: "n1", body: "Called", at: "2026-06-10T06:00:00.000Z" }],
      history: [change("h1", "2026-06-10T06:00:00.000Z", "note")],
      invoices: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("note");
  });

  it("sinks an undated note to the end rather than the top", () => {
    const out = mergeTimeline({
      notes: [{ _id: "n1", body: "old import, no date" }],
      history: [change("h1", "2026-05-01T06:00:00.000Z")],
      invoices: [],
    });
    expect(out.map((e) => e.kind)).toEqual(["change", "note"]);
  });

  it("carries no invoices when given none — the viewer without billing sees calls and changes only", () => {
    const out = mergeTimeline({ notes: [], history: [change("h1", "2026-05-01T06:00:00.000Z")], invoices: [] });
    expect(out.every((e) => e.kind !== "invoice")).toBe(true);
  });
});
