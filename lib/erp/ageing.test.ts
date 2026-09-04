import { describe, expect, it } from "vitest";
import { ageBucket, ageingShares, groupByParty, partyTone, summariseAgeing } from "./ageing";

describe("ageBucket", () => {
  it("puts the boundaries in the band they belong to", () => {
    // Inclusive at the top: day 30 is still current, day 31 is not.
    expect(ageBucket(0)).toBe("current");
    expect(ageBucket(30)).toBe("current");
    expect(ageBucket(31)).toBe("d31_60");
    expect(ageBucket(60)).toBe("d31_60");
    expect(ageBucket(61)).toBe("d61_90");
    expect(ageBucket(90)).toBe("d61_90");
    expect(ageBucket(91)).toBe("d90_plus");
    expect(ageBucket(400)).toBe("d90_plus");
  });

  it("treats a negative age as current rather than dropping it", () => {
    /*
      A clock skew or a back-dated import. A debt that is not yet due is
      exactly what "current" means, and silently losing the row would make
      the bands disagree with the total beside them.
    */
    expect(ageBucket(-3)).toBe("current");
  });
});

describe("summariseAgeing", () => {
  it("adds each invoice into exactly one band", () => {
    const totals = summariseAgeing([
      { daysOld: 5, owedPaise: 10000 },
      { daysOld: 30, owedPaise: 5000 },
      { daysOld: 45, owedPaise: 20000 },
      { daysOld: 75, owedPaise: 30000 },
      { daysOld: 200, owedPaise: 40000 },
    ]);
    expect(totals).toEqual({
      current: 15000,
      d31_60: 20000,
      d61_90: 30000,
      d90_plus: 40000,
    });
  });

  it("sums to the same figure the list does", () => {
    // The bands are a breakdown, not a second opinion. If they do not add up
    // to the total printed beside them, one of the two is a lie.
    const rows = [
      { daysOld: 1, owedPaise: 111 },
      { daysOld: 44, owedPaise: 222 },
      { daysOld: 91, owedPaise: 333 },
    ];
    const totals = summariseAgeing(rows);
    const banded = Object.values(totals).reduce((a, b) => a + b, 0);
    expect(banded).toBe(rows.reduce((t, r) => t + r.owedPaise, 0));
  });

  it("is all zeroes for nothing owed", () => {
    expect(summariseAgeing([])).toEqual({
      current: 0,
      d31_60: 0,
      d61_90: 0,
      d90_plus: 0,
    });
  });
});

describe("groupByParty", () => {
  const row = (over: Partial<Parameters<typeof groupByParty>[0][0]>) => ({
    contactId: "c1",
    partyName: "Rameshbhai",
    partyPhone: "9825012345",
    owedPaise: 10000,
    daysOld: 10,
    ...over,
  });

  it("rolls several invoices up into one customer", () => {
    const [party] = groupByParty([
      row({ owedPaise: 10000, daysOld: 10 }),
      row({ owedPaise: 25000, daysOld: 70 }),
    ]);
    expect(party.invoices).toBe(2);
    expect(party.owedPaise).toBe(35000);
    // Urgency comes from the OLDEST, not the newest.
    expect(party.oldestDays).toBe(70);
  });

  it("groups on the contact, not on the name printed at the time", () => {
    /*
      The party is a snapshot taken at issue, so the same farmer can read
      differently on two invoices a year apart. Two invoices to one person is
      one phone call either way.
    */
    const parties = groupByParty([
      row({ partyName: "Ramesh Patel" }),
      row({ partyName: "Rameshbhai Patel" }),
    ]);
    expect(parties).toHaveLength(1);
    expect(parties[0].invoices).toBe(2);
  });

  it("keeps unlinked invoices apart by name rather than lumping them", () => {
    const parties = groupByParty([
      row({ contactId: null, partyName: "Walk-in A" }),
      row({ contactId: null, partyName: "Walk-in B" }),
      row({ contactId: null, partyName: "Walk-in A" }),
    ]);
    expect(parties).toHaveLength(2);
    expect(parties.find((p) => p.name === "Walk-in A")?.invoices).toBe(2);
  });

  it("keeps the first usable phone number", () => {
    // Older invoices may carry a number in a shape dialable() will not take,
    // or none at all; the group should still offer one if any invoice has it.
    const [party] = groupByParty([
      row({ partyPhone: "" }),
      row({ partyPhone: "9825012345" }),
    ]);
    expect(party.phone).toBe("9825012345");
  });

  it("puts the biggest debt first", () => {
    const parties = groupByParty([
      row({ contactId: "a", partyName: "Small", owedPaise: 1000 }),
      row({ contactId: "b", partyName: "Big", owedPaise: 90000 }),
      row({ contactId: "c", partyName: "Middle", owedPaise: 5000 }),
    ]);
    expect(parties.map((p) => p.name)).toEqual(["Big", "Middle", "Small"]);
  });
});

describe("ageingShares", () => {
  it("adds up to exactly 100, whatever the rounding wants", () => {
    // 1/3 each would round to 33 + 33 + 33 = 99 without the remainder step.
    const shares = ageingShares({ current: 100, d31_60: 100, d61_90: 100, d90_plus: 0 });
    expect(shares.reduce((n, s) => n + s.share, 0)).toBe(100);
    expect(shares.map((s) => s.share)).toEqual([34, 33, 33, 0]);
  });

  it("gives the whole bar to a single band", () => {
    expect(ageingShares({ current: 0, d31_60: 0, d61_90: 0, d90_plus: 5 }).map((s) => s.share)).toEqual([0, 0, 0, 100]);
  });

  it("is four zeros when nothing is owed", () => {
    expect(ageingShares({ current: 0, d31_60: 0, d61_90: 0, d90_plus: 0 }).map((s) => s.share)).toEqual([0, 0, 0, 0]);
  });

  it("keeps the bands in their order", () => {
    expect(ageingShares({ current: 1, d31_60: 2, d61_90: 3, d90_plus: 4 }).map((s) => s.key)).toEqual([
      "current",
      "d31_60",
      "d61_90",
      "d90_plus",
    ]);
  });
});

describe("partyTone", () => {
  it("is red past 60 days, flagged past 30, quiet before", () => {
    expect(partyTone(10)).toBeUndefined();
    expect(partyTone(30)).toBeUndefined();
    expect(partyTone(31)).toBe("warn");
    expect(partyTone(61)).toBe("danger");
  });
});

describe("groupByParty totals", () => {
  it("sums what was invoiced, paid and credited alongside what is owed", () => {
    const [party] = groupByParty([
      { contactId: "c", partyName: "A", partyPhone: "", owedPaise: 300, daysOld: 10, grandTotalPaise: 1000, paidPaise: 500, creditedPaise: 200 },
      { contactId: "c", partyName: "A", partyPhone: "", owedPaise: 400, daysOld: 40, grandTotalPaise: 400, paidPaise: 0, creditedPaise: 0 },
    ]);
    expect(party).toMatchObject({ invoices: 2, owedPaise: 700, invoicedPaise: 1400, paidPaise: 500, creditedPaise: 200, oldestDays: 40 });
  });
});
