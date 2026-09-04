/**
 * A refusal written for the person raising the document — "FloraMax has no
 * GST rate set" — as opposed to an internal fault. Routes turn it into a 400
 * carrying the message. In its own file so the stock module can extend it
 * without importing the invoice engine, which imports the stock module.
 */
export class InvoiceError extends Error {}
