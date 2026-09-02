import { NextResponse } from "next/server";
import { EXPORT_CAP, toCsv } from "@/lib/csv";
import { istParts } from "@/lib/time";

/**
 * A list, as a file the browser saves.
 *
 * The same headers the GST download has always sent. `no-store` because a
 * cached export is yesterday's list with today's date on it.
 *
 * Rows past EXPORT_CAP are not silently dropped: the file ends with one line
 * saying it was cut, so the person reading it knows to narrow the filter
 * rather than trust a total. A quietly short export is the same defect as a
 * quietly short total.
 */
export function csvResponse(
  name: string,
  headers: string[],
  rows: (string | number)[][],
): NextResponse {
  const capped = rows.length > EXPORT_CAP;
  const body = capped ? rows.slice(0, EXPORT_CAP) : rows;
  const csv =
    toCsv(headers, body) +
    (capped
      ? `\r\nCut at ${EXPORT_CAP} rows. Narrow the search or filter and export again.`
      : "");

  const { year, month, day } = istParts(new Date());
  const stamp = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}

/** Every export reads one more than the cap, so the response can say it was cut. */
export const EXPORT_READ = EXPORT_CAP + 1;
