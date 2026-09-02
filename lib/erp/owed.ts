/**
 * What one invoice is still owed.
 *
 * Invoiced, less what was received, less what has been CREDITED BACK. The
 * third term was missing on every screen but the invoice's own: a ₹10,000
 * invoice with ₹4,000 credited and nothing paid was chased for ₹10,000 on the
 * Outstanding list, prefilled as ₹10,000 on the payment form, and counted as
 * ₹10,000 on the dashboard — while its detail page said ₹6,000. Two screens
 * disagreeing about the same money, and the WhatsApp reminder carried the
 * wrong one.
 *
 * Never negative: an overpayment or a rounding credit is not a debt, and
 * "owes −₹12" reads as a bug.
 *
 * Its own file, with no imports, so the payment form (a client component) and
 * the aggregation in lib/erp/reports.ts read the same definition.
 */
export function owedOnInvoice(
  grandTotalPaise: number,
  paidPaise: number,
  creditedPaise: number,
): number {
  return Math.max(0, grandTotalPaise - paidPaise - creditedPaise);
}
