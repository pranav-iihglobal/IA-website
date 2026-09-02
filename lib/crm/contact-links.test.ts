import { describe, expect, it } from "vitest";
import { dialable, telHref, whatsappHref, paymentReminder } from "./contact-links";

/**
 * Getting a number wrong here rings a stranger, so the shapes the sheets
 * actually carry are all pinned — and anything ambiguous returns nothing
 * rather than a guess.
 */
describe("turning a stored number into a dialable one", () => {
  it("adds the country code to a plain ten-digit number", () => {
    expect(dialable("9825012345")).toBe("919825012345");
  });

  it("handles the shapes the sheets carry", () => {
    expect(dialable("+91 98250 12345")).toBe("919825012345");
    expect(dialable("098250 12345")).toBe("919825012345");
    expect(dialable("98250-12345")).toBe("919825012345");
  });

  it("does not double the country code", () => {
    expect(dialable("919825012345")).toBe("919825012345");
  });

  it("returns nothing rather than guessing at something odd", () => {
    /*
      A number this cannot be confident about must produce NO link. Offering
      one that dials a stranger is worse than offering none.
    */
    expect(dialable("")).toBeNull();
    expect(dialable("12345")).toBeNull();
    expect(dialable("not a number")).toBeNull();
    expect(dialable("9825012345678901")).toBeNull();
  });
});

describe("the links themselves", () => {
  it("builds a tel: link", () => {
    expect(telHref("98250 12345")).toBe("tel:+919825012345");
  });

  it("builds a WhatsApp link with the message escaped", () => {
    const href = whatsappHref("9825012345", "Invoice IA.09.26.007 — ₹1,050");
    expect(href).toContain("https://wa.me/919825012345?text=");
    // The rupee sign and the dash must survive the round trip.
    expect(decodeURIComponent(href!.split("text=")[1])).toBe(
      "Invoice IA.09.26.007 — ₹1,050",
    );
  });

  it("omits the query when there is no message", () => {
    expect(whatsappHref("9825012345")).toBe("https://wa.me/919825012345");
  });

  it("gives no link at all for an unusable number", () => {
    expect(telHref("")).toBeNull();
    expect(whatsappHref("123")).toBeNull();
  });
});

describe("the payment reminder", () => {
  it("names the invoice and the amount", () => {
    // "You owe us money" prompts a call back asking which one.
    const text = paymentReminder({
      name: "Yogeshbhai",
      number: "IA.09.26.007",
      amount: "₹1,050",
    });
    expect(text).toContain("Yogeshbhai");
    expect(text).toContain("IA.09.26.007");
    expect(text).toContain("₹1,050");
  });
});
