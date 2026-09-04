import type { ContactRow } from "./shape";
import { FOLLOW_UP_LABELS, STATUS_LABELS } from "./shape";
import { paiseToRupeeString } from "@/lib/money";
import { formatIstDate } from "@/lib/time";

/**
 * A contact list as a spreadsheet: which columns, in which order, written
 * how.
 *
 * Money as a plain "1234.56" (paiseToRupeeString — the one thing that
 * crosses the rupee boundary, and what the GST sheets already use), dates as
 * dd-mm-yyyy in IST, and a Sample column so a seeded row can never be taken
 * for a real farmer once the file is away from the screen that marked it.
 *
 * The header count and the cell count are asserted equal in the test — a
 * column that drifts shifts every value after it one heading to the left,
 * and nobody reading the file would know.
 */
export const CONTACT_EXPORT_HEADERS = [
  "Id",
  "Type",
  "Name",
  "Business",
  "Phone",
  "Village / taluka",
  "District",
  "Region",
  "Crop",
  "Source",
  "Owner",
  "Status",
  "Days since last order",
  "Lifetime orders",
  "Lifetime revenue",
  "Follow-up stage",
  "Next action",
  "Follow-up due",
  "GSTIN",
  "Demo",
  "Updated",
];

function kindLabel(row: ContactRow): string {
  if (row.kind === "lead") return "Lead";
  return row.channel === "b2b" ? "Dealer" : "Customer";
}

function date(value: string | null): string {
  return value ? formatIstDate(new Date(value)) : "";
}

export function contactExportRow(row: ContactRow): (string | number)[] {
  return [
    row.contactId,
    kindLabel(row),
    row.name,
    row.businessName,
    row.phone,
    row.place,
    row.district,
    row.region,
    row.crop,
    row.source,
    row.owner,
    row.kind === "lead" ? "" : STATUS_LABELS[row.status],
    row.daysSinceLastOrder ?? "",
    row.lifetimeOrders,
    paiseToRupeeString(row.lifetimeRevenuePaise),
    FOLLOW_UP_LABELS[row.followUpStatus as keyof typeof FOLLOW_UP_LABELS] ?? row.followUpStatus,
    row.nextAction,
    date(row.followUpAt),
    row.gstin,
    row.isSample ? "yes" : "",
    date(row.updatedAt),
  ];
}
