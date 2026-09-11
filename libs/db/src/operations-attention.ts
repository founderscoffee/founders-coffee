import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';

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

/**
 * Events that have ended and have no closeout prompt scheduled.
 *
 * The recovery half of CO-05: whatever the creation hook failed to write, or was never asked to
 * write because the event predates it, is derived here from state that already exists.
 *
 * The anti-join is on `scheduled_notifications` rather than on a separate intent table, because the
 * prompt row *is* the intent — a row of any status counts as scheduled, including one cancelled when
 * the event was called off, which is precisely when no prompt should be re-derived.
 *
 * Bounded both ways. `endedAfter` stops the query walking the whole history of the product every
 * night for gatherings nobody will close out now; `limit` stops one night's backlog becoming one
 * night's write storm.
 */
export const listEventsMissingCloseoutPrompt = (
  db: Db,
  opts: { endedAfter: Date; endsBefore: Date; limit: number },
) =>
  db
    .select({
      id: events.id,
      hostId: events.hostId,
      marketCode: events.marketCode,
      title: events.title,
      venue: events.venue,
      slug: events.slug,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
    })
    .from(events)
    .leftJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        sql`${events.status} != 'cancelled'`,
        sql`${events.endsAt} IS NOT NULL`,
        gte(events.endsAt, opts.endedAfter),
        lt(events.endsAt, opts.endsBefore),
        isNull(eventCloseouts.eventId),
        sql`NOT EXISTS (
          SELECT 1 FROM scheduled_notifications
          WHERE event_id = ${events.id}
            AND template_key = 'closeout_prompt')`,
      ),
    )
    .orderBy(events.endsAt)
    .limit(opts.limit);
