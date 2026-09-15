import { and, eq, sql } from 'drizzle-orm';

import type {
  FeedbackEligibilityStatus,
  FeedbackSubmissionOutcome,
} from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  eventAttendance,
  eventCloseouts,
  eventFeedback,
  events,
  type EventFeedbackRow,
  type Event,
} from './schema.js';
import { listUpcomingEvents } from './events.js';

export type FeedbackOutcome = FeedbackSubmissionOutcome;
export type FeedbackEligibility = FeedbackEligibilityStatus;

const SEVEN_DAYS = 7 * 24 * 60 * 60;
const FOURTEEN_DAYS = 14 * 24 * 60 * 60;

/**
 * This member attended, the closeout invited them, and the window is still open.
 *
 * All three parts of §5.20 in one predicate, evaluated against the database's clock:
 *
 * - the closeout says `held` and was submitted within seven days of the end, which is what creates
 *   the invitation at all;
 * - the member has an `attended` row, because a pulse from someone who did not come measures
 *   nothing;
 * - now is within fourteen days of `ends_at` — anchored to the event and not to the closeout, which
 *   is precisely what stops a late closeout reopening a window that has expired.
 *
 * Written as one conditional insert rather than three reads: a window that closes between checking
 * and writing has to close the write too, and on D1 that means the check and the write are the same
 * statement.
 */
const feedbackAllowed = (eventId: string, userId: string) =>
  sql`event_closeouts.event_id = ${eventId}
      AND event_closeouts.outcome = 'held'
      AND events.ends_at IS NOT NULL
      AND event_closeouts.submitted_at - events.ends_at <= ${SEVEN_DAYS}
      AND unixepoch() - events.ends_at <= ${FOURTEEN_DAYS}
      AND EXISTS (
        SELECT 1 FROM event_attendance
        WHERE event_id = ${eventId}
          AND user_id = ${userId}
          AND outcome = 'attended')`;

/**
 * Save the pulse, or update the one this member already left.
 *
 * `ON CONFLICT (event_id, user_id) DO UPDATE` gives §5.7's "one updateable pulse" without a read:
 * a member changing their mind inside the window edits their row, and outside it the guard has
 * already refused the insert so there is nothing to update.
 *
 * The comment and its language move together. The schema permits a null pair and a complete pair;
 * the domain schema rejects the halves, and this write carries whatever it is given as a unit, so
 * a comment can never arrive stripped of the language §5.23 renders it in.
 */
export const saveFeedback = async (
  db: Db,
  input: {
    eventId: string;
    userId: string;
    rowId: string;
    rating: 'valuable' | 'okay' | 'not_valuable';
    wouldReturn: boolean;
    comment?: string;
    commentLanguage?: 'ar' | 'fr' | 'en';
  },
): Promise<{ outcome: FeedbackOutcome; row?: EventFeedbackRow }> => {
  const result = await db
    .insert(eventFeedback)
    .select(
      db
        .select({
          id: sql<string>`${input.rowId}`.as('id'),
          eventId: sql<string>`${input.eventId}`.as('event_id'),
          userId: sql<string>`${input.userId}`.as('user_id'),
          marketCode: events.marketCode,
          stateCode: events.stateCode,
          cityCode: events.cityCode,
          valueRating: sql<string>`${input.rating}`.as('value_rating'),
          wouldReturn: sql<number>`${input.wouldReturn ? 1 : 0}`.as(
            'would_return',
          ),
          comment: sql<string | null>`${input.comment ?? null}`.as('comment'),
          commentLanguage: sql<
            string | null
          >`${input.commentLanguage ?? null}`.as('comment_language'),
          createdAt: sql<number>`unixepoch()`.as('created_at'),
          updatedAt: sql<number>`unixepoch()`.as('updated_at'),
        })
        .from(eventCloseouts)
        .innerJoin(events, sql`events.id = event_closeouts.event_id`)
        .where(feedbackAllowed(input.eventId, input.userId)),
    )
    .onConflictDoUpdate({
      target: [eventFeedback.eventId, eventFeedback.userId],
      set: {
        valueRating: input.rating,
        wouldReturn: input.wouldReturn,
        comment: input.comment ?? null,
        commentLanguage: input.commentLanguage ?? null,
        updatedAt: new Date(),
      },
    });

  if (!(result as { meta?: { changes?: number } })?.meta?.changes)
    return { outcome: await refusalFor(db, input.eventId, input.userId) };

  const rows = await db
    .select()
    .from(eventFeedback)
    .where(
      and(
        eq(eventFeedback.eventId, input.eventId),
        eq(eventFeedback.userId, input.userId),
      ),
    )
    .limit(1);
  return { outcome: 'saved', row: rows[0] };
};

const refusalFor = async (
  db: Db,
  eventId: string,
  userId: string,
): Promise<FeedbackOutcome> => {
  const attended = await db
    .select({ id: eventAttendance.id })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, eventId),
        eq(eventAttendance.userId, userId),
        eq(eventAttendance.outcome, 'attended'),
      ),
    )
    .limit(1);
  if (attended.length === 0) return 'not_attended';

  const rows = await db
    .select({
      endsAt: events.endsAt,
      outcome: eventCloseouts.outcome,
      submittedAt: eventCloseouts.submittedAt,
    })
    .from(events)
    .leftJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(eq(events.id, eventId))
    .limit(1);
  const row = rows[0];
  if (!row?.endsAt || !row.submittedAt || row.outcome !== 'held')
    return 'not_invited';
  const invited =
    row.submittedAt.getTime() - row.endsAt.getTime() <= SEVEN_DAYS * 1000;
  if (!invited) return 'not_invited';
  return 'window_closed';
};

export const getFeedback = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<EventFeedbackRow | undefined> => {
  const rows = await db
    .select()
    .from(eventFeedback)
    .where(
      and(
        eq(eventFeedback.eventId, opts.eventId),
        eq(eventFeedback.userId, opts.userId),
      ),
    )
    .limit(1);
  return rows[0];
};

export const getFeedbackEligibility = async (
  db: Db,
  opts: { eventId: string; userId: string; now?: Date },
): Promise<FeedbackEligibility> => {
  const attended = await db
    .select({ id: eventAttendance.id })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, opts.eventId),
        eq(eventAttendance.userId, opts.userId),
        eq(eventAttendance.outcome, 'attended'),
      ),
    )
    .limit(1);
  if (attended.length === 0) return 'not_attended';
  const rows = await db
    .select({
      endsAt: events.endsAt,
      outcome: eventCloseouts.outcome,
      submittedAt: eventCloseouts.submittedAt,
    })
    .from(events)
    .leftJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(eq(events.id, opts.eventId))
    .limit(1);
  const row = rows[0];
  if (!row?.endsAt || row.outcome !== 'held' || !row.submittedAt)
    return 'not_invited';
  const endMs = row.endsAt.getTime();
  if (row.submittedAt.getTime() - endMs > SEVEN_DAYS * 1000)
    return 'not_invited';
  return (opts.now ?? new Date()).getTime() - endMs <= FOURTEEN_DAYS * 1000
    ? 'ready'
    : 'window_closed';
};

export const findNextEvent = async (
  db: Db,
  opts: { marketCode: string; cityCode: string; now?: Date },
): Promise<Event | undefined> => {
  const rows = await listUpcomingEvents(db, {
    marketCode: opts.marketCode,
    cityCode: opts.cityCode,
    limit: 1,
    now: opts.now,
  });
  return rows[0];
};

/**
 * The aggregate a host or an operator may see, which never includes who said what.
 *
 * §5.7 keeps individual feedback private by default and out of public event pages entirely. The
 * comments are deliberately absent from this projection: a host reading three comments on a meetup
 * of four people has effectively been told who wrote them.
 */
export const feedbackTally = async (
  db: Db,
  eventId: string,
): Promise<{
  responses: number;
  wouldReturn: number;
  valuable: number;
  okay: number;
  notValuable: number;
}> => {
  const rows = await db
    .select({
      responses: sql<number>`count(*)`.as('responses'),
      wouldReturn:
        sql<number>`sum(case when would_return = 1 then 1 else 0 end)`.as(
          'would_return',
        ),
      valuable:
        sql<number>`sum(case when value_rating = 'valuable' then 1 else 0 end)`.as(
          'valuable',
        ),
      okay: sql<number>`sum(case when value_rating = 'okay' then 1 else 0 end)`.as(
        'okay',
      ),
      notValuable:
        sql<number>`sum(case when value_rating = 'not_valuable' then 1 else 0 end)`.as(
          'not_valuable',
        ),
    })
    .from(eventFeedback)
    .where(eq(eventFeedback.eventId, eventId));
  const row = rows[0];
  return {
    responses: row?.responses ?? 0,
    wouldReturn: row?.wouldReturn ?? 0,
    valuable: row?.valuable ?? 0,
    okay: row?.okay ?? 0,
    notValuable: row?.notValuable ?? 0,
  };
};
