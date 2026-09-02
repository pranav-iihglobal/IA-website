/**
 * One value out of a page's `searchParams`.
 *
 * Next hands a repeated key over as an array; a list URL never means that,
 * so the first wins. Every list page had its own copy of this three-line
 * helper.
 */
export function one(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
