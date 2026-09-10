import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  eventAttendance,
  eventCloseouts,
  eventFeedback,
  events,
  hostTrust,
  operationsAudit,
  operationsReviews,
} from './schema.js';

const DAY_SECONDS = 24 * 60 * 60;
export const OPERATIONS_RETENTION_DAYS = 730;
export const COMMENT_RETENTION_DAYS = 365;
export const TRUST_RETENTION_AFTER_CLOSURE_DAYS = 730;

export interface RetentionReport {
  readonly commentsCleared: number;
  readonly feedbackDeleted: number;
  readonly attendanceDeleted: number;
  readonly closeoutsDeleted: number;
  readonly reviewsDeleted: number;
  readonly auditDeleted: number;
}

const cutoff = (now: Date, days: number) =>
  Math.floor(now.getTime() / 1000) - days * DAY_SECONDS;

/**
 * Clear comment text at twelve months while the structured pulse survives to twenty-four.
 *
 * §5.21 gives comments the shorter period because they are the only member-authored prose in the
 * operations schema — a rating is a category and a sentence is a person writing. The row is kept
 * and blanked rather than deleted, so the return-intent and value-rating aggregates computed from
 * it do not silently shrink when the text ages out.
 *
 * The language goes with the text. A `comment_language` describing a comment that no longer exists
 * is a fact about somebody with nothing left to attach it to.
 */
export const clearAgedComments = async (
  db: Db,
  opts: { marketCode: string; now: Date; limit: number },
): Promise<number> => {
  const result = await db.run(
    sql`UPDATE event_feedback
        SET comment = NULL, comment_language = NULL, updated_at = unixepoch()
        WHERE id IN (
          SELECT id FROM event_feedback
          WHERE market_code = ${opts.marketCode}
            AND comment IS NOT NULL
            AND created_at < ${cutoff(opts.now, COMMENT_RETENTION_DAYS)}
          LIMIT ${opts.limit})`,
  );
  return (result as { meta?: { changes?: number } })?.meta?.changes ?? 0;
};

/**
 * Retire the operations rows that have passed twenty-four months, in bounded batches.
 *
 * Market-scoped and limited because §5.21 requires it to be safe to run repeatedly: a single
 * unbounded DELETE across every market is the kind of maintenance job that times out halfway and
 * leaves nobody sure what it did. Each call removes at most `limit` rows per table and reports what
 * it removed, so a caller can loop until the report is empty.
 *
 * The monthly aggregate snapshots are deliberately untouched. They carry no PII and §5.21 keeps
 * them indefinitely — they are what lets the community's history outlive the rows it came from.
 *
 * Every delete is a typed builder over a bounded subselect rather than assembled SQL. Market codes
 * come from our own catalogue today, which is exactly the reasoning that puts a concatenated value
 * into a DELETE and leaves it there until the day something else supplies one.
 */
export const retireAgedOperations = async (
  db: Db,
  opts: { marketCode: string; now: Date; limit: number },
): Promise<RetentionReport> => {
  const before = new Date(
    opts.now.getTime() - OPERATIONS_RETENTION_DAYS * DAY_SECONDS * 1000,
  );
  const commentsCleared = await clearAgedComments(db, opts);

  const changesOf = (result: unknown) =>
    (result as { meta?: { changes?: number } })?.meta?.changes ?? 0;

  const feedback = await db.delete(eventFeedback).where(
    inArray(
      eventFeedback.id,
      db
        .select({ id: eventFeedback.id })
        .from(eventFeedback)
        .where(
          and(
            eq(eventFeedback.marketCode, opts.marketCode),
            lt(eventFeedback.createdAt, before),
          ),
        )
        .limit(opts.limit),
    ),
  );

  const attendance = await db.delete(eventAttendance).where(
    inArray(
      eventAttendance.id,
      db
        .select({ id: eventAttendance.id })
        .from(eventAttendance)
        .where(
          and(
            eq(eventAttendance.marketCode, opts.marketCode),
            lt(eventAttendance.recordedAt, before),
          ),
        )
        .limit(opts.limit),
    ),
  );

  const reviews = await db.delete(operationsReviews).where(
    inArray(
      operationsReviews.id,
      db
        .select({ id: operationsReviews.id })
        .from(operationsReviews)
        .where(
          and(
            eq(operationsReviews.marketCode, opts.marketCode),
            lt(operationsReviews.evidenceWindowEnd, before),
          ),
        )
        .limit(opts.limit),
    ),
  );

  const audit = await db.delete(operationsAudit).where(
    inArray(
      operationsAudit.id,
      db
        .select({ id: operationsAudit.id })
        .from(operationsAudit)
        .where(
          and(
            eq(operationsAudit.marketCode, opts.marketCode),
            lt(operationsAudit.createdAt, before),
          ),
        )
        .limit(opts.limit),
    ),
  );

  const closeouts = await db.delete(eventCloseouts).where(
    inArray(
      eventCloseouts.eventId,
      db
        .select({ eventId: eventCloseouts.eventId })
        .from(eventCloseouts)
        .where(
          and(
            eq(eventCloseouts.marketCode, opts.marketCode),
            lt(eventCloseouts.submittedAt, before),
          ),
        )
        .limit(opts.limit),
    ),
  );

  return {
    commentsCleared,
    feedbackDeleted: changesOf(feedback),
    attendanceDeleted: changesOf(attendance),
    closeoutsDeleted: changesOf(closeouts),
    reviewsDeleted: changesOf(reviews),
    auditDeleted: changesOf(audit),
  };
};

/**
 * Detach one member from the operations record without erasing what happened.
 *
 * Deletion has to remove the person and keep the evidence: the community's density, retention and
 * no-show numbers describe meetups that took place, and a departing member does not un-happen them.
 * So their feedback text and their attendance rows go, and the closeout — which counts people
 * rather than naming them — stays.
 *
 * §5.21 calls this "removes or anonymizes member-linked data while retaining lawful aggregate
 * evidence", and PF-10 orchestrates it. Offered here so the operations schema owns its own
 * deletion semantics rather than having them written a second time from the account lane.
 */
export const withdrawMemberOperations = async (
  db: Db,
  userId: string,
): Promise<{ feedbackDeleted: number; attendanceDeleted: number }> => {
  const feedback = await db
    .delete(eventFeedback)
    .where(eq(eventFeedback.userId, userId));
  const attendance = await db
    .delete(eventAttendance)
    .where(eq(eventAttendance.userId, userId));
  return {
    feedbackDeleted:
      (feedback as { meta?: { changes?: number } })?.meta?.changes ?? 0,
    attendanceDeleted:
      (attendance as { meta?: { changes?: number } })?.meta?.changes ?? 0,
  };
};

/**
 * Trust rows for accounts that closed more than twenty-four months ago.
 *
 * Listed rather than deleted: §5.21 keeps current host trust for the account lifetime plus twenty-
 * four months, and whether an individual row has passed that is a judgement about a specific person
 * that CO-09 should make deliberately rather than a sweep make silently.
 */
export const listExpiredHostTrust = (
  db: Db,
  opts: { marketCode: string; now: Date; limit: number },
) =>
  db
    .select({
      id: hostTrust.id,
      userId: hostTrust.userId,
      status: hostTrust.status,
      updatedAt: hostTrust.updatedAt,
    })
    .from(hostTrust)
    .where(
      and(
        eq(hostTrust.marketCode, opts.marketCode),
        lt(
          hostTrust.updatedAt,
          new Date(
            opts.now.getTime() -
              TRUST_RETENTION_AFTER_CLOSURE_DAYS * DAY_SECONDS * 1000,
          ),
        ),
      ),
    )
    .limit(opts.limit);

/** Completed events per host, for the recurring-host and retention definitions in §6. */
export const listHostCompletionHistory = (
  db: Db,
  opts: { marketCode: string; since: Date },
) =>
  db
    .select({
      userId: events.hostId,
      completedAt: events.endsAt,
    })
    .from(eventCloseouts)
    .innerJoin(events, eq(events.id, eventCloseouts.eventId))
    .where(
      and(
        eq(eventCloseouts.marketCode, opts.marketCode),
        eq(eventCloseouts.outcome, 'held'),
        isNotNull(events.endsAt),
        sql`${events.endsAt} >= ${Math.floor(opts.since.getTime() / 1000)}`,
      ),
    );

/** Attended events per member, for the repeat-participation definition in §6. */
export const listAttendeeHistory = (
  db: Db,
  opts: { marketCode: string; since: Date },
) =>
  db
    .select({
      userId: eventAttendance.userId,
      attendedAt: events.endsAt,
    })
    .from(eventAttendance)
    .innerJoin(events, eq(events.id, eventAttendance.eventId))
    .innerJoin(
      eventCloseouts,
      eq(eventCloseouts.eventId, eventAttendance.eventId),
    )
    .where(
      and(
        eq(eventAttendance.marketCode, opts.marketCode),
        eq(eventAttendance.outcome, 'attended'),
        eq(eventCloseouts.outcome, 'held'),
        isNotNull(events.endsAt),
        sql`${events.endsAt} >= ${Math.floor(opts.since.getTime() / 1000)}`,
      ),
    );
