import { NextResponse } from "next/server";

/**
 * Stop the second person's save from silently erasing the first person's.
 *
 * Every edit in this panel was `findByIdAndUpdate` with the whole validated
 * payload and no version check. Two directors opening the same customer on two
 * phones — which is the normal case here, not an edge one — meant whoever
 * saved second overwrote the other's changes completely. No warning, no
 * conflict, and nothing in the audit log to suggest anything had been lost,
 * because as far as the second save was concerned it simply wrote what it was
 * given.
 *
 * Mongoose already keeps `__v` on every document, so the fix costs nothing to
 * store: the form remembers the version it loaded, sends it back, and the
 * update only matches a document still on that version.
 *
 * WHY NOT A MERGE. Deciding which side of a conflicting edit wins is a
 * judgement about the business, not about the data — and getting it wrong
 * silently is the thing being fixed. Telling someone plainly that they need to
 * look again is the honest outcome.
 */

export const STALE_WRITE_MESSAGE =
  "Somebody else saved this while you had it open. Your changes have not been " +
  "saved — close this and open it again to see theirs first.";

/**
 * A filter that matches only if nobody has saved since the form loaded.
 *
 * A missing or non-numeric version means the caller cannot promise anything —
 * a script, or a form written before this existed — so the check is skipped
 * rather than failing closed. Failing closed there would break the import and
 * the seed scripts, which have no version to send and no concurrent writer to
 * fear.
 */
export function versionedFilter(
  id: string,
  version: unknown,
): Record<string, unknown> {
  return Number.isInteger(version)
    ? { _id: id, __v: version as number }
    : { _id: id };
}

/**
 * The other half of the check: the update must MOVE the version.
 *
 * Mongoose only touches `__v` on `save()`, and only when an array changed.
 * A `findOneAndUpdate` — which is every edit route here — leaves it exactly
 * where it was, so a record saved a hundred times was still on version 0,
 * and a form that had loaded version 0 an hour earlier matched it every
 * time. The guard passed its own review and never once refused a save.
 *
 * Spread into the update beside the fields. Mongoose wraps the plain fields
 * in `$set` itself, so an operator can sit next to them (the contacts route
 * already puts `$addToSet` there).
 */
export function bumpVersion(): { $inc: { __v: 1 } } {
  return { $inc: { __v: 1 } };
}

/** True when a versioned update matched nothing but the document is still there. */
export function isStaleWrite(matched: unknown, exists: unknown): boolean {
  return !matched && Boolean(exists);
}

/** 409, with a sentence written for the person who is about to lose work. */
export function staleWriteResponse(): NextResponse {
  return NextResponse.json({ error: STALE_WRITE_MESSAGE }, { status: 409 });
}
