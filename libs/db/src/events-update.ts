import { and, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { events, type NewEvent } from './schema.js';

/**
 * Apply a host's edit, but only to the row they were looking at.
 *
 * The `version` match in the WHERE clause is the whole mechanism: a save built from a stale page
 * changes nothing and returns 0, and the caller answers with a conflict rather than overwriting
 * whatever landed in between. `status` is matched too, so an event cancelled while the form was
 * open cannot be edited back into existence — the edit finds no row and says so.
 *
 * The counter is bumped in the same statement that applies the patch, so there is no window
 * between reading a version and superseding it.
 *
 * `slug` is not in the patch and must never be: it is the address every already-shared link points
 * at. See the table's own note in `schema.ts`.
 */
export const updateEventIfCurrent = async (
  db: Db,
  id: string,
  expectedVersion: number,
  patch: Partial<NewEvent>,
): Promise<number> => {
  const result = await db
    .update(events)
    .set({
      ...patch,
      version: expectedVersion + 1,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(events.id, id),
        eq(events.version, expectedVersion),
        eq(events.status, 'published'),
      ),
    )
    .run();
  const meta = (result as { meta?: { changes?: number } }).meta;
  return meta?.changes ?? 0;
};
