/**
 * Gujarat's districts, as the state actually names them.
 *
 * `Contact.district` was free text — and it is INDEXED and FILTERED ON, which
 * is what made that a bug rather than an untidiness. "Sabarkantha" and "Sabar
 * Kantha" are two districts to a filter, so filtering silently returned an
 * incomplete list: the failure direction nobody investigates, because a
 * shorter list looks like a correct answer.
 *
 * `REGIONS` next to it in the model was already a proper enum. District is the
 * one that got missed.
 *
 * NOT an enum on the model, deliberately. There are 5,118 contacts waiting to
 * be imported carrying whatever their sheet says, and a schema that refuses
 * them would block the import rather than clean it. The list drives the
 * picker; anything already stored still displays.
 */
export const GUJARAT_DISTRICTS = [
  "Ahmedabad",
  "Amreli",
  "Anand",
  "Aravalli",
  "Banaskantha",
  "Bharuch",
  "Bhavnagar",
  "Botad",
  "Chhota Udaipur",
  "Dahod",
  "Dang",
  "Devbhoomi Dwarka",
  "Gandhinagar",
  "Gir Somnath",
  "Jamnagar",
  "Junagadh",
  "Kheda",
  "Kutch",
  "Mahisagar",
  "Mehsana",
  "Morbi",
  "Narmada",
  "Navsari",
  "Panchmahal",
  "Patan",
  "Porbandar",
  "Rajkot",
  "Sabarkantha",
  "Surat",
  "Surendranagar",
  "Tapi",
  "Vadodara",
  "Valsad",
] as const;

/**
 * Options for a picker, including whatever is already stored.
 *
 * A record whose district predates the list must not silently lose it when
 * somebody opens the form and saves — so the current value is always offered,
 * marked, rather than quietly reset to blank.
 */
export function districtOptions(
  current: string,
): { value: string; label: string }[] {
  const known = GUJARAT_DISTRICTS as readonly string[];
  const extra =
    current && !known.includes(current)
      ? [{ value: current, label: `${current} (not in the list)` }]
      : [];
  return [
    { value: "", label: "—" },
    ...extra,
    ...known.map((d) => ({ value: d, label: d })),
  ];
}
