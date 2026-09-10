import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { eventCloseouts, events } from './schema.js';

/**
 * Events that ended more than a day ago with nothing recorded about them.
 *
 * The §6 definition, as a query: ended, not cancelled, no closeout. Legacy rows with no `ends_at`
 * are absent by construction — they belong to {@link listEventsMissingEndTime}, which is a
 * different problem needing a different action.
 */
export const listOverdueCloseouts = (
  db: Db,
  opts: { marketCode: string; now: Date; limit: number },
) =>
  db
    .select({
      id: events.id,
      title: events.title,
      hostId: events.hostId,
      endsAt: events.endsAt,
    })
    .from(events)
    .leftJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        eq(events.marketCode, opts.marketCode),
        sql`${events.status} != 'cancelled'`,
        sql`${events.endsAt} IS NOT NULL`,
        lt(events.endsAt, new Date(opts.now.getTime() - 24 * 60 * 60 * 1000)),
        isNull(eventCloseouts.eventId),
      ),
    )
    .orderBy(events.endsAt)
    .limit(opts.limit);

/**
 * The events CO-08 has to show an operator, because nothing else can be done with them.
 *
 * §5.24 excludes `ends_at IS NULL` events from every operational path and requires them to appear in
 * an attention state instead. They are listed rather than fixed: a backfill is an explicit audited
 * action by someone who knows when the meetup actually finished, and no duration is inferred here
 * or anywhere else.
 */
export const listEventsMissingEndTime = (
  db: Db,
  opts: { marketCode: string; limit: number },
) =>
  db
    .select({
      id: events.id,
      title: events.title,
      hostId: events.hostId,
      startsAt: events.startsAt,
    })
    .from(events)
    .where(and(eq(events.marketCode, opts.marketCode), isNull(events.endsAt)))
    .orderBy(events.startsAt)
    .limit(opts.limit);
