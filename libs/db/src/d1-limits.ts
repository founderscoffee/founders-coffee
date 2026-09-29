import { getTableColumns } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

export const D1_MAX_BOUND_PARAMETERS = 100;

/**
 * Split a list into consecutive pieces of at most `size` items.
 */
export const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let offset = 0; offset < items.length; offset += size)
    chunks.push(items.slice(offset, offset + size));
  return chunks;
};

/**
 * Split rows for a multi-row insert into `table` so no statement binds more values than D1 accepts.
 *
 * D1 refuses a statement with more than 100 bound parameters ("too many SQL variables"), and
 * Miniflare enforces the same limit. Drizzle binds a value for every column a row names and for
 * every column with a JavaScript-side default, so the safe count per row is the table's full column
 * count rather than the keys a caller happened to pass.
 */
export const insertChunks = <T>(
  table: SQLiteTable,
  rows: readonly T[],
): T[][] =>
  chunked(
    rows,
    Math.max(
      1,
      Math.floor(
        D1_MAX_BOUND_PARAMETERS / Object.keys(getTableColumns(table)).length,
      ),
    ),
  );
