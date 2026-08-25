/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Loosely-typed result of a Mongoose `.lean()` query.
 *
 * Mongoose's inferred lean types are extremely wide and fight with the
 * hand-written public shapes in queries.ts, so the mapping layer accepts this
 * instead. Kept in one place (with one eslint exemption) rather than
 * scattering `any` casts through routes and pages — every value read from a
 * LeanDoc is validated or normalised before it is used.
 */
export type LeanDoc = Record<string, any>;
