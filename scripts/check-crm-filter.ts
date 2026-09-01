/**
 * Checks the query behind every CRM list.
 *
 *   npm run check-crm-filter
 *
 * This exists because the search that shipped did not work: it used a MongoDB
 * text index, which matches whole terms only, so typing half a name found
 * nothing. The filter was a private helper inside the route handler, which
 * meant it could not be run without a server and a database, which meant it
 * was never run at all until two directors ran it.
 *
 * It is a pure function now, so it can be. No connection is opened here — the
 * assertions are about the query we send, not about what Mongo does with it.
 */
import { buildFilter } from "../lib/crm/filter";

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  if (passed) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures++;
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`      ${detail}`);
}

/** The filter as the route builds it, from a query string. */
function filterFor(query: string) {
  return buildFilter(new URLSearchParams(query));
}

/** Does this filter's search branch match the given value? */
function matches(filter: Record<string, unknown>, field: string, value: string) {
  const clauses = (filter.$or ?? []) as Record<string, RegExp>[];
  const clause = clauses.find((c) => field in c);
  return clause ? clause[field].test(value) : false;
}

console.log("\n  Search — the bug that started this\n");

const partial = filterFor("search=Kher");
check(
  "a partial word matches mid-word (Kher finds Kherva)",
  matches(partial, "village", "Kherva"),
  "this is exactly what the text index could not do",
);
check(
  "matching is case-insensitive (yog finds Yogeshbhai)",
  matches(filterFor("search=yog"), "name", "Yogeshbhai"),
);
check(
  "a full word still works (Mehsana finds the district)",
  matches(filterFor("search=Mehsana"), "district", "Mehsana"),
);
check(
  "their own ids are searchable (IKS-C-0 finds IKS-C-034)",
  matches(filterFor("search=IKS-C-0"), "contactId", "IKS-C-034"),
);
check(
  "taluka is searched, since every row of their sheets has one",
  matches(filterFor("search=Visnagar"), "taluka", "Visnagar"),
);
check(
  "no text query is sent any more",
  !("$text" in filterFor("search=Kher")),
  "$text stems and tokenises; it can never match a prefix",
);
check(
  "a search that matches nothing is still a search",
  !matches(filterFor("search=Kher"), "village", "Mehsana"),
);

console.log("\n  Phone numbers\n");

const phone = filterFor("search=955");
check(
  "a digit string becomes an anchored phone match",
  phone.phone instanceof RegExp && phone.phone.source === "^955",
  `got ${JSON.stringify(phone)}`,
);
check(
  "and anchored means anchored — 955 does not match ...955...",
  phone.phone instanceof RegExp && !phone.phone.test("98955 12345"),
);
check(
  "a formatted number is normalised first",
  (filterFor("search=" + encodeURIComponent("(+91) 98765-43210")).phone as RegExp)
    ?.source === "^919876543210",
);
check(
  "one or two digits are a search, not a phone number",
  Boolean(filterFor("search=12").$or),
  "nobody looks up a contact by a two-digit phone number",
);

console.log("\n  Input that used to throw\n");

for (const nasty of ["(", "a(b", "*", "\\", "[", "?", "a.b"]) {
  let built: ReturnType<typeof filterFor> | null = null;
  let error: unknown = null;
  try {
    built = filterFor("search=" + encodeURIComponent(nasty));
  } catch (e) {
    error = e;
  }
  check(
    `${JSON.stringify(nasty)} does not throw`,
    built !== null,
    error instanceof Error ? error.message : undefined,
  );
}

check(
  "and metacharacters are matched literally, not interpreted",
  matches(filterFor("search=" + encodeURIComponent("a.b")), "name", "a.b") &&
    !matches(filterFor("search=" + encodeURIComponent("a.b")), "name", "axb"),
);

console.log("\n  The rest of the query string\n");

check("an empty search adds nothing", Object.keys(filterFor("")).length === 0);
check(
  "whitespace is not a search",
  Object.keys(filterFor("search=" + encodeURIComponent("   "))).length === 0,
);
check(
  "a search still respects the list it is on",
  (() => {
    const f = filterFor("kind=customer&channel=b2b&search=Kher");
    return f.kind === "customer" && f.channel === "b2b" && Boolean(f.$or);
  })(),
  "searching in Dealers must not return leads",
);
check(
  "an unknown kind is ignored rather than passed through",
  !("kind" in filterFor("kind=owner")),
);
check(
  "the due view asks for a follow-up date in the past",
  (() => {
    const due = filterFor("due=1").followUpAt as { $lte: Date; $ne: null };
    return due?.$lte instanceof Date && due.$ne === null;
  })(),
);

console.log(
  failures === 0
    ? "\n  All checks passed.\n"
    : `\n  ${failures} check${failures === 1 ? "" : "s"} failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
