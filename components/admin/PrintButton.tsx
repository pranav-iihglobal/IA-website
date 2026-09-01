"use client";

/** window.print() needs a client component; the invoice itself does not. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full border border-black px-4 py-1.5 text-sm font-semibold"
    >
      Print / Save as PDF
    </button>
  );
}
