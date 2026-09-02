"use client";

/** window.print() needs a client component; the invoice itself does not. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      /* 44px, like every other control in the panel. This one was ~32px, on
         the screen most likely to be tapped one-handed in front of somebody. */
      className="inline-flex min-h-11 items-center rounded-full border border-black px-4 text-sm font-semibold"
    >
      Print / Save as PDF
    </button>
  );
}
