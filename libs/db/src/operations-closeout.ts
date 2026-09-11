import { and, eq, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { auditStatement, type AuditEntry } from './operations-audit.js';
import { eventCloseouts, events, type EventCloseoutRow } from './schema.js';

export type CloseoutOutcome =
  | 'submitted'
  | 'already_closed'
  | 'not_host'
  | 'not_ended'
  | 'no_end_time'
  | 'event_cancelled';

export type CorrectionOutcome = 'corrected' | 'stale_version' | 'not_closed';

export interface SubmitCloseoutRow {
  readonly eventId: string;
  readonly actorId: string;
  readonly outcome: 'held' | 'did_not_happen';
  readonly walkInCount: number;
  readonly wouldHostAgain: boolean | null;
  readonly hostFriction: readonly string[];
  readonly privateNote?: string;
  readonly auditId: string;
  readonly accessSubject?: string | null;
}

/**
 * The event is over, was not cancelled, and knows when it ended.
 *
 * Evaluated inside the write rather than read first. §5.6 forbids read-decide-write on D1 entirely,
 * and the reason bites here: between reading an event and inserting its closeout, the host could
 * cancel it, and a closeout on a cancelled event double-counts the same outcome in reliability
 * reporting. `ends_at IS NOT NULL` is the §5.24 rule in the same predicate — a legacy event with no
 * recorded end is excluded from closeout rather than given an inferred one.
 */
/**
 * Closeable, and not already closed.
 *
 * The audit entry must be guarded on the same condition that decides whether the closeout landed,
 * which is the `ON CONFLICT DO NOTHING` and not `closeable` alone. `closeable` reads only the events
 * table — host, not cancelled, ended — and a second submission satisfies it just as well as the
 * first, so an audit guarded on it records a submission on every retry while the insert quietly does
 * nothing. An append-only trail asserting things that did not happen is worse than no trail.
 *
 * `correctCloseout` already guards its audit on the same `EXISTS` its update uses; this is the same
 * discipline, stated for the insert — and like that one, the audit statement must come **first** in
 * the batch. D1 applies a batch in declaration order inside one transaction, so an audit placed after
 * the insert would find the closeout it is about to describe already present and never fire.
 */
const notYetClosed = (eventId: string, hostId: string) =>
  sql`${closeable(eventId, hostId)}
      AND NOT EXISTS (
        SELECT 1 FROM event_closeouts WHERE event_id = ${eventId})`;

const closeable = (eventId: string, hostId: string) =>
  sql`id = ${eventId}
      AND host_id = ${hostId}
      AND status != 'cancelled'
      AND ends_at IS NOT NULL
      AND ends_at <= unixepoch()`;

/**
 * Why a closeout was refused, asked only once the write has already declined to happen.
 *
 * The guard above is one predicate and returns one fact: nothing was written. The member still
 * needs to know which of five reasons applied, and that is a read — but a read taken *after* the
 * decision, so it can only ever describe a refusal, never authorize one. A stale answer here
 * mislabels an error message; a stale answer before the write would have written the row.
 */
const refusalFor = async (
  db: Db,
  eventId: string,
  actorId: string,
): Promise<CloseoutOutcome> => {
  const rows = await db
    .select({
      hostId: events.hostId,
      status: events.status,
      endsAt: events.endsAt,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  const event = rows[0];
  if (!event) return 'not_host';
  if (event.hostId !== actorId) return 'not_host';
  if (event.status === 'cancelled') return 'event_cancelled';
  if (event.endsAt === null) return 'no_end_time';
  return event.endsAt.getTime() > Date.now() ? 'not_ended' : 'already_closed';
};

/**
 * Record what happened, copying the event's geography rather than trusting the caller's.
 *
 * The insert selects from `events`, so market, state and city come from the row being closed out
 * and cannot be nominated by a client. §5.19 scopes every operations record to a market, and a
 * market code supplied alongside an event id is one typo away from filing a Chlef meetup under
 * Algiers — the join is what makes that impossible rather than merely discouraged.
 *
 * `ON CONFLICT DO NOTHING` on the primary key makes a double submit idempotent: the second one
 * writes nothing and is reported as `already_closed`, rather than raising a constraint error the
 * caller has to pattern-match. The audit entry rides in the same batch, so an outcome recorded
 * without an audit trail is not a state this table can reach.
 */
export const submitCloseout = async (
  db: Db,
  input: SubmitCloseoutRow,
): Promise<{ outcome: CloseoutOutcome; row?: EventCloseoutRow }> => {
  const audit: AuditEntry = {
    id: input.auditId,
    actorUserId: input.actorId,
    accessSubject: input.accessSubject ?? null,
    action: 'closeout_submitted',
    targetType: 'closeout',
    targetId: input.eventId,
    reasonCode: null,
    metadata: { outcome: input.outcome, walkInCount: input.walkInCount },
  };

  const [, inserted] = await batch(db, [
    auditStatement(
      db,
      audit,
      events,
      events.marketCode,
      notYetClosed(input.eventId, input.actorId),
    ),
    db
      .insert(eventCloseouts)
      .select(
        db
          .select({
            eventId: events.id,
            marketCode: events.marketCode,
            stateCode: events.stateCode,
            cityCode: events.cityCode,
            outcome: sql<string>`${input.outcome}`.as('outcome'),
            walkInCount: sql<number>`${input.walkInCount}`.as('walk_in_count'),
            wouldHostAgain: sql<number | null>`${input.wouldHostAgain}`.as(
              'would_host_again',
            ),
            hostFriction:
              sql<string>`${JSON.stringify([...input.hostFriction])}`.as(
                'host_friction',
              ),
            privateNote: sql<string | null>`${input.privateNote ?? null}`.as(
              'private_note',
            ),
            submittedByUserId: sql<string>`${input.actorId}`.as(
              'submitted_by_user_id',
            ),
            submittedAt: sql<number>`unixepoch()`.as('submitted_at'),
            updatedByUserId: sql<string | null>`NULL`.as('updated_by_user_id'),
            updatedAt: sql<number>`unixepoch()`.as('updated_at'),
            version: sql<number>`0`.as('version'),
          })
          .from(events)
          .where(closeable(input.eventId, input.actorId)),
      )
      .onConflictDoNothing(),
  ]);

  const changes = (inserted as { meta?: { changes?: number } })?.meta?.changes;
  if (!changes)
    return { outcome: await refusalFor(db, input.eventId, input.actorId) };

  const rows = await db
    .select()
    .from(eventCloseouts)
    .where(eq(eventCloseouts.eventId, input.eventId))
    .limit(1);
  return { outcome: 'submitted', row: rows[0] };
};

/**
 * Change a recorded outcome, but only the version the corrector was looking at.
 *
 * `version = expected` in the same UPDATE is the whole concurrency model: two admins correcting the
 * same closeout produce one winner and one `stale_version`, rather than one silently overwriting
 * the other's judgement about what happened at a meetup neither of them attended.
 *
 * The audit entry carries the reason and the before/after outcome, and is written in the same
 * batch. §7 requires the audit stream to reconstruct who changed what and why; a correction that
 * could land without one would leave the mutable row as the only account of itself.
 *
 * It is the *first* statement in the batch, and the order is load-bearing. D1 applies a batch in
 * order inside one transaction, so an audit guarded on `version = expected` and placed after the
 * update would evaluate against the version the update had already bumped, and never write. Placed
 * first, both statements see the same pre-update row: either both apply or the transaction rolls
 * back and neither does.
 */
export const correctCloseout = async (
  db: Db,
  input: {
    eventId: string;
    expectedVersion: number;
    actorId: string;
    accessSubject?: string | null;
    outcome: 'held' | 'did_not_happen';
    walkInCount: number;
    wouldHostAgain: boolean | null;
    hostFriction: readonly string[];
    reason: string;
    auditId: string;
  },
): Promise<{ outcome: CorrectionOutcome; row?: EventCloseoutRow }> => {
  const before = await db
    .select({
      outcome: eventCloseouts.outcome,
      version: eventCloseouts.version,
    })
    .from(eventCloseouts)
    .where(eq(eventCloseouts.eventId, input.eventId))
    .limit(1);
  if (before.length === 0) return { outcome: 'not_closed' };

  const [, updated] = await batch(db, [
    auditStatement(
      db,
      {
        id: input.auditId,
        actorUserId: input.actorId,
        accessSubject: input.accessSubject ?? null,
        action: 'closeout_corrected',
        targetType: 'closeout',
        targetId: input.eventId,
        reasonCode: input.reason,
        metadata: {
          before: before[0]?.outcome,
          after: input.outcome,
          version: input.expectedVersion,
        },
      },
      events,
      events.marketCode,
      and(
        eq(events.id, input.eventId),
        sql`EXISTS (SELECT 1 FROM event_closeouts
                    WHERE event_id = ${input.eventId}
                      AND version = ${input.expectedVersion})`,
      ),
    ),
    db
      .update(eventCloseouts)
      .set({
        outcome: input.outcome,
        walkInCount: input.walkInCount,
        wouldHostAgain: input.wouldHostAgain,
        hostFriction: [...input.hostFriction],
        updatedByUserId: input.actorId,
        updatedAt: new Date(),
        version: sql`${eventCloseouts.version} + 1`,
      })
      .where(
        and(
          eq(eventCloseouts.eventId, input.eventId),
          eq(eventCloseouts.version, input.expectedVersion),
        ),
      ),
  ]);

  if (!(updated as { meta?: { changes?: number } })?.meta?.changes)
    return { outcome: 'stale_version' };

  const rows = await db
    .select()
    .from(eventCloseouts)
    .where(eq(eventCloseouts.eventId, input.eventId))
    .limit(1);
  return { outcome: 'corrected', row: rows[0] };
};

export const getCloseout = async (
  db: Db,
  eventId: string,
): Promise<EventCloseoutRow | undefined> => {
  const rows = await db
    .select()
    .from(eventCloseouts)
    .where(eq(eventCloseouts.eventId, eventId))
    .limit(1);
  return rows[0];
};
