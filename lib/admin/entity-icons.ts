/**
 * One icon path per kind of record, by the entity name the audit log stores.
 *
 * The sidebar drew each of these inline; the activity feed needs the same
 * shapes beside each entry so a row reads as "an invoice" before the words
 * do. One table, both places, so the two cannot drift. 24×24 stroke paths.
 */
export const ENTITY_ICON_PATHS: Record<string, string> = {
  Contact: "M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  Invoice: "M6 3h9l3 3v15l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5V3Zm3 5h6M9 12h6M9 16h4",
  Purchase: "M6 7h12l-1 12H7L6 7Zm3 0V5a3 3 0 0 1 6 0v2",
  StockItem: "M4 8l8-4 8 4v8l-8 4-8-4V8Zm0 0 8 4m0 0 8-4m-8 4v8",
  Supplier: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01",
  Product: "M20 7.5 12 3 4 7.5m16 0L12 12M20 7.5v9L12 21m0-9L4 7.5M12 12v9m-8-4.5v-9",
  Post: "M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5",
  Testimonial: "M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12Z",
  User: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  Settings: "M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15M4 21h16M8 8h3M8 12h3M8 16h3M15 11h3a2 2 0 0 1 2 2v8",
  Scheme: "M20 12 12 20 4 12V4h8l8 8ZM7.5 7.5h.01M14 10l-4 4",
};

/** A record kind nothing here knows — a plain document. */
export const UNKNOWN_ENTITY_ICON = "M6 3h9l3 3v15H6V3Zm9 0v3h3M9 12h6M9 16h6";

export function entityIconPath(entity: string): string {
  return ENTITY_ICON_PATHS[entity] ?? UNKNOWN_ENTITY_ICON;
}
