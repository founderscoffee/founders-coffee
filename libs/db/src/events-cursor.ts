import { and, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { events } from './schema.js';
import { upcomingScope } from './events.js';

/**
 * Whether a feed cursor names a row that is still in the feed it claims to paginate.
 *
 * The keyset query needs no such row to exist: `(startsAt, id) > (afterStartsAt, afterId)` is a
 * comparison, so an invented cursor returns the rows after that point, and a cursor far enough in
 * the past returns the whole first page. That is correct paging and wrong as a web page — every
 * made-up cursor became a distinct URL serving page one, answering 200 and declaring itself
 * canonical, which is an unbounded duplicate surface for a crawler to walk.
 *
 * Both halves of the cursor are checked against one row, so a cursor cannot be assembled from a
 * real id and an arbitrary timestamp. The scope is checked too: a cursor is only valid for the
 * feed it came out of, not for another market's. `upcomingScope` is included deliberately, so a
 * cursor whose anchor event has already started reads as stale rather than as a position.
 */
export const feedCursorAnchorExists = async (
  db: Db,
  opts: {
    startsAt: Date;
    id: string;
    marketCode?: string;
    cityCode?: string;
    hostId?: string;
    now?: Date;
  },
): Promise<boolean> => {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.id, opts.id),
        eq(events.startsAt, opts.startsAt),
        upcomingScope(opts.now ?? new Date()),
        eq(events.status, 'published'),
        opts.marketCode ? eq(events.marketCode, opts.marketCode) : undefined,
        opts.cityCode ? eq(events.cityCode, opts.cityCode) : undefined,
        opts.hostId ? eq(events.hostId, opts.hostId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
};
