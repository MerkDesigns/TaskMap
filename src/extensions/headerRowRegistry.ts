import type { ElementExtensions } from "../types";
import type { HeaderHost } from "./headerControl";
import type { HeaderRow } from "./headerRow";
import { searchHeaderRow } from "./search/searchHeaderRow";

/** Extension header rows in display order. */
const headerRows: readonly HeaderRow[] = Object.freeze([searchHeaderRow]);

/** The rows an element's header shows: installed on it, and offered for its type. */
export function headerRowsFor(
  host: HeaderHost,
  extensions: ElementExtensions,
): readonly HeaderRow[] {
  return headerRows.filter(
    (row) => row.hosts.includes(host) && extensions[row.extension] !== undefined,
  );
}

/** The height the rows add below the header. */
export const headerRowsHeight = (rows: readonly HeaderRow[]): number =>
  rows.reduce((total, row) => total + row.height, 0);
