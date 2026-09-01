import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Atomic sequence numbers, one document per series.
 *
 * Invoice numbers cannot be `count + 1`. Two directors raising an invoice in
 * the same second would both read the same count and both write the same
 * number — and a duplicate invoice number is not a bug you fix afterwards,
 * it is a filing already submitted with two documents claiming one identity.
 *
 * `findOneAndUpdate` with `$inc` is atomic INSIDE the server, so two
 * concurrent callers are serialised by MongoDB itself and get different
 * numbers. No transaction, no lock, and nothing that needs a replica set
 * feature M0 does not have.
 *
 * `_id` is the series key, so the uniqueness that matters is the primary key
 * and cannot be worked around.
 */

const counterSchema = new Schema(
  {
    /** The series, e.g. "invoice:25-26:09". Human-readable on purpose. */
    _id: { type: String, required: true },
    /** The last number ISSUED. The next one is seq + 1. */
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, _id: false },
);

export type CounterDoc = InferSchemaType<typeof counterSchema>;

export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) ??
  model<CounterDoc>("Counter", counterSchema);

/**
 * Take the next number in a series. Never returns the same number twice.
 *
 * Upserts, so a brand new series starts at 1 without anyone seeding it.
 */
export async function nextInSeries(series: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    series,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}

/**
 * Raise a series to at least `value`. Used by the historical import.
 *
 * `$max`, NOT `$set`. The 53 invoices already filed have to be imported before
 * any new one is raised, and the counter must continue from the last real
 * number rather than restart at 001 — but an import re-run, or run out of
 * order, must never drag the counter BACKWARDS onto numbers already issued.
 * `$max` makes going backwards impossible rather than merely discouraged.
 */
export async function raiseSeriesTo(series: string, value: number): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    series,
    { $max: { seq: value } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc!.seq;
}

/** What a series currently stands at, without touching it. 0 if unused. */
export async function peekSeries(series: string): Promise<number> {
  const doc = await Counter.findById(series).lean();
  return doc?.seq ?? 0;
}
