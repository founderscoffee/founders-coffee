import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { eventCloseouts, events } from './schema.js';

/**
 * Events that ended more than a day ago with nothing recorded about them.
 *
 * The attention definition, as a query: ended, not cancelled, no closeout. Legacy rows with no `ends_at`
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
 * Events with `ends_at IS NULL` are excluded from every operational path and appear in an attention
 * state instead. They are listed rather than fixed: a backfill is an explicit audited
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

/**
 * Events called off whose frozen going set has not all been told.
 *
 * `submitCloseoutResolver` fans the notice out one member at a time after the closeout is already
 * durable, so a fan-out that dies partway leaves some members told and the rest not. The host's
 * retry resumes it — but only if they retry. This is what covers the host who closed the tab.
 *
 * The anti-join is per **member**, not per event: an event with nine notices out of ten is exactly
 * the case this exists for, and an `EXISTS` on the event as a whole would call it done. The host is
 * excluded from the audience for the same reason the fan-out excludes them — they are the one who
 * said it did not happen.
 *
 * Bounded both ways, like {@link listEventsMissingCloseoutPrompt}. The window is deliberately days
 * rather than the prompt's fortnight: telling somebody a gathering did not take place is only worth
 * saying while they might still be wondering.
 */
export const listEventsMissingDidNotHappenNotices = (
  db: Db,
  opts: { endedAfter: Date; limit: number },
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
    .innerJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        eq(eventCloseouts.outcome, 'did_not_happen'),
        gte(events.endsAt, opts.endedAfter),
        sql`EXISTS (
          SELECT 1 FROM event_rsvps
          WHERE event_rsvps.event_id = ${events.id}
            AND event_rsvps.status = 'going'
            AND event_rsvps.user_id != ${events.hostId}
            AND NOT EXISTS (
              SELECT 1 FROM scheduled_notifications
              WHERE scheduled_notifications.event_id = ${events.id}
                AND scheduled_notifications.user_id = event_rsvps.user_id
                AND scheduled_notifications.template_key = 'event_did_not_happen'))`,
      ),
    )
    .orderBy(events.endsAt)
    .limit(opts.limit);
