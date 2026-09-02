/**
 * Which page numbers to draw: the first, the last, and a window around the
 * current one, with gaps for everything else.
 *
 * `null` is a gap. Kept to a narrow window because this strip also renders on
 * a 358px phone, where nine numbers and two arrows is already the full width.
 */
export function pageNumbers(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const window = new Set<number>([1, pages, page]);
  if (page - 1 > 1) window.add(page - 1);
  if (page + 1 < pages) window.add(page + 1);

  const sorted = [...window].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push(null);
    out.push(sorted[i]);
  }
  return out;
}
