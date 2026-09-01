/**
 * Which navigation item owns the page you are looking at.
 *
 * Its own module, and pure, for the same reason `buildFilter()` and
 * `snapshotLine()` are: it is the only real logic in the sidebar, and both of
 * its rules are the kind that look obviously right and are quietly wrong.
 */

export interface NavTarget {
  href: string;
  /** Active only on this exact path. For /admin, which prefixes everything. */
  exact?: boolean;
  /**
   * Extra paths this item owns, beyond its own prefix.
   *
   * A customer's profile lives at /admin/contacts/<id> rather than under any
   * of the three lists that link to it, so without this the whole sidebar goes
   * dark the moment you open one — and "nothing is selected" reads as being
   * lost rather than as being somewhere shared.
   */
  owns?: string[];
}

export function itemActive(item: NavTarget, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return [item.href, ...(item.owns ?? [])].some(
    /*
      A prefix, but only on a segment boundary. A bare startsWith would light
      up /admin/customers for a future /admin/customers-archive — two items
      selected at once, which looks like a rendering fault rather than a
      routing one and would be looked for in the wrong place.
    */
    (owned) => pathname === owned || pathname.startsWith(`${owned}/`),
  );
}
