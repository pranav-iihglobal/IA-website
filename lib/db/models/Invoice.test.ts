import { describe, expect, it } from "vitest";
import { illegalChanges } from "./Invoice";

/**
 * The lock on an issued invoice.
 *
 * This is the rule the whole ERP rests on — an invoice already filed with the
 * GST department must not be able to change. Tested as a pure function
 * because a save hook needs a cluster to exercise, and a rule that can only
 * be checked by hand against production is a rule that quietly stops working.
 * scripts/check-erp.ts proves the hook is actually wired to it.
 */

const draft = { status: "draft" };
const issued = { status: "issued" };
const cancelled = { status: "cancelled" };
const historical = { status: "issued", isHistorical: true };

describe("a draft", () => {
  it("can change anything at all", () => {
    expect(illegalChanges(["lines", "party.name", "grandTotalPaise"], draft)).toEqual([]);
  });
});

describe("an issued invoice", () => {
  it("refuses a change to the lines", () => {
    expect(illegalChanges(["lines"], issued)).toEqual(["lines"]);
  });

  it("refuses a change to a total", () => {
    // A rounding fix shipped in 2027 must not restate a 2025 invoice.
    expect(illegalChanges(["grandTotalPaise"], issued)).toEqual(["grandTotalPaise"]);
  });

  it("refuses a change to the party", () => {
    // A customer moving village must not rewrite last year's document.
    expect(illegalChanges(["party.village"], issued)).toEqual(["party.village"]);
  });

  it("refuses a change to the seller", () => {
    // A bank account changed in October must not rewrite a September invoice.
    expect(illegalChanges(["seller.bank.accountNo"], issued)).toEqual(["seller.bank.accountNo"]);
  });

  it("refuses a change to its number", () => {
    expect(illegalChanges(["number"], issued)).toEqual(["number"]);
  });

  it("reports every illegal path, not just the first", () => {
    expect(illegalChanges(["lines", "number", "party.gstin"], issued)).toEqual([
      "lines",
      "number",
      "party.gstin",
    ]);
  });
});

describe("what may still change after issue", () => {
  it("allows payment, because money arriving is a fact about the world", () => {
    expect(
      illegalChanges(
        ["payment.status", "payment.paidPaise", "payment.referenceNo", "payment.paidAt"],
        issued,
      ),
    ).toEqual([]);
  });

  it("allows a note", () => {
    expect(illegalChanges(["notes"], issued)).toEqual([]);
  });

  it("allows cancelling, which is how a mistake is undone", () => {
    // Stated as previous → new, because "status" alone is ambiguous about
    // which of the two it means, and that ambiguity was the bug.
    expect(
      illegalChanges(["status", "cancelledAt", "cancelledReason"], { status: "cancelled" }, "issued"),
    ).toEqual([]);
  });

  it("still refuses the rest alongside an allowed one", () => {
    expect(illegalChanges(["payment.status", "lines"], issued)).toEqual(["lines"]);
  });
});

describe("a historical invoice", () => {
  it("is frozen even though the 53 were filed long ago", () => {
    expect(illegalChanges(["lines"], historical)).toEqual(["lines"]);
  });

  it("is frozen even in draft status, unlike anything else", () => {
    // isHistorical wins over status: these are a record of what was filed.
    expect(illegalChanges(["grandTotalPaise"], { status: "draft", isHistorical: true })).toEqual(
      ["grandTotalPaise"],
    );
  });
});

describe("a cancelled invoice", () => {
  it("stays frozen — it keeps its number and its figures", () => {
    expect(illegalChanges(["lines"], cancelled)).toEqual(["lines"]);
    expect(illegalChanges(["number"], cancelled)).toEqual(["number"]);
  });
});

describe("the status field cannot be used to unlock an invoice", () => {
  /*
    The bypass this suite exists to keep closed.

    `frozen` is computed from the status being SAVED. So setting an issued
    invoice back to "draft" made the hook see a draft, allow it, and save —
    after which every line, total and party edit was permitted, because the
    document really was a draft by then. One field, and the guarantee the
    whole ERP rests on was gone.
  */
  it("refuses issued → draft", () => {
    expect(illegalChanges(["status"], { status: "draft" }, "issued")).toEqual([
      "status",
    ]);
  });

  it("refuses cancelled → draft", () => {
    expect(illegalChanges(["status"], { status: "draft" }, "cancelled")).toEqual([
      "status",
    ]);
  });

  it("refuses issued → issued being used to smuggle a line change", () => {
    expect(
      illegalChanges(["status", "lines"], { status: "draft" }, "issued"),
    ).toEqual(["status", "lines"]);
  });

  it("still allows issued → cancelled, which is how a mistake is undone", () => {
    expect(
      illegalChanges(["status", "cancelledAt", "cancelledReason"], { status: "cancelled" }, "issued"),
    ).toEqual([]);
  });

  it("still allows a draft to become issued", () => {
    // Issuing happens on a new document, but a draft saved again must work.
    expect(illegalChanges(["status"], { status: "issued" }, "draft")).toEqual([]);
  });

  it("refuses a historical invoice being cancelled", () => {
    // The 53 already filed are frozen outright — see the historical rule.
    expect(
      illegalChanges(["status"], { status: "cancelled", isHistorical: true }, "issued"),
    ).toEqual(["status"]);
  });
});
