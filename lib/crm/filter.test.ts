import { describe, expect, it } from "vitest";
import { buildFilter } from "./filter";
import { SCOPE_QUERY, scopeFor } from "./scopes";

/**
 * The query behind every CRM list.
 *
 * These exist because the search that shipped did not work: it used a MongoDB
 * text index, which matches whole terms only, so typing half a name found
 * nothing. The filter was a private helper inside the route handler — it could
 * not be run without a server and a database, so it was never run at all until
 * two directors ran it.
 *
 * No connection is opened here. The assertions are about the query we send,
 * not about what Mongo does with it.
 */

/** The filter as the route builds it, from a query string. */
function filterFor(query: string) {
  return buildFilter(new URLSearchParams(query));
}

/** Does this filter's search branch match the given value? */
function matches(filter: Record<string, unknown>, field: string, value: string) {
  const clauses = (filter.$or ?? []) as Record<string, RegExp>[];
  const clause = clauses.find((c) => field in c);
  return clause ? clause[field].test(value) : false;
}

describe("search", () => {
  it("matches mid-word — Kher finds Kherva", () => {
    // Exactly what the text index could not do.
    expect(matches(filterFor("search=Kher"), "village", "Kherva")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matches(filterFor("search=yog"), "name", "Yogeshbhai")).toBe(true);
  });

  it("still matches a whole word", () => {
    expect(matches(filterFor("search=Mehsana"), "district", "Mehsana")).toBe(true);
  });

  it("finds a contact by their own id", () => {
    expect(matches(filterFor("search=IKS-C-0"), "contactId", "IKS-C-034")).toBe(true);
  });

  it("searches taluka, which every row of their sheets has", () => {
    expect(matches(filterFor("search=Visnagar"), "taluka", "Visnagar")).toBe(true);
  });

  it("never sends a text query", () => {
    // $text stems and tokenises; it can never match a prefix.
    expect(filterFor("search=Kher")).not.toHaveProperty("$text");
  });

  it("does not match something else entirely", () => {
    expect(matches(filterFor("search=Kher"), "village", "Mehsana")).toBe(false);
  });
});

describe("phone numbers", () => {
  it("becomes an anchored prefix match", () => {
    const phone = filterFor("search=955").phone as RegExp;
    expect(phone.source).toBe("^955");
  });

  it("is anchored — 955 does not match a number containing 955", () => {
    const phone = filterFor("search=955").phone as RegExp;
    expect(phone.test("98955 12345")).toBe(false);
  });

  it("normalises a formatted number first", () => {
    const q = "search=" + encodeURIComponent("(+91) 98765-43210");
    expect((filterFor(q).phone as RegExp).source).toBe("^919876543210");
  });

  it("treats one or two digits as a search, not a phone number", () => {
    // Nobody looks up a contact by a two-digit phone number.
    expect(filterFor("search=12").$or).toBeDefined();
  });
});

describe("input that used to throw", () => {
  it.each(["(", "a(b", "*", "\\", "[", "?", "a.b"])("%j does not throw", (nasty) => {
    expect(() => filterFor("search=" + encodeURIComponent(nasty))).not.toThrow();
  });

  it("matches metacharacters literally rather than interpreting them", () => {
    const q = "search=" + encodeURIComponent("a.b");
    expect(matches(filterFor(q), "name", "a.b")).toBe(true);
    expect(matches(filterFor(q), "name", "axb")).toBe(false);
  });
});

describe("the rest of the query string", () => {
  it("adds nothing for an empty search", () => {
    expect(filterFor("")).toEqual({});
  });

  it("does not treat whitespace as a search", () => {
    expect(filterFor("search=" + encodeURIComponent("   "))).toEqual({});
  });

  it("keeps a search inside the list it is on", () => {
    // Searching in Dealers must not return leads.
    const f = filterFor("kind=customer&channel=b2b&search=Kher");
    expect(f.kind).toBe("customer");
    expect(f.channel).toBe("b2b");
    expect(f.$or).toBeDefined();
  });

  it("ignores an unknown kind rather than passing it through", () => {
    expect(filterFor("kind=owner")).not.toHaveProperty("kind");
  });

  it("asks for a follow-up date in the past for the due view", () => {
    const due = filterFor("due=1").followUpAt as { $lte: Date; $ne: null };
    expect(due.$lte).toBeInstanceOf(Date);
    expect(due.$ne).toBeNull();
  });
});

describe("scopeFor", () => {
  it("puts a lead in Leads regardless of channel", () => {
    expect(scopeFor("lead", "")).toBe("leads");
    expect(scopeFor("lead", "b2b")).toBe("leads");
  });

  it("splits customers by channel", () => {
    expect(scopeFor("customer", "b2b")).toBe("dealers");
    expect(scopeFor("customer", "b2c")).toBe("customers");
  });

  it("treats an unset channel as B2C rather than throwing", () => {
    // Older records predate the field; they belong in Customers, not nowhere.
    expect(scopeFor("customer", "")).toBe("customers");
  });

  it("round-trips with SCOPE_QUERY", () => {
    // The two are inverses; if they disagree a profile shows the wrong form.
    for (const scope of ["customers", "dealers", "leads"] as const) {
      const q = SCOPE_QUERY[scope];
      expect(scopeFor(q.kind, q.channel ?? "")).toBe(scope);
    }
  });
});
