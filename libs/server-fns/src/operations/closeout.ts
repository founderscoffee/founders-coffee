import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  correctCloseout,
  getCloseout,
  getEvent,
  recordAttendance,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import type { operations } from '@founders-coffee/domain';

import { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';
import { listCloseoutRoster, type RosterMember } from './roster.js';

export interface CloseoutView {
  readonly eventId: string;
  readonly outcome: 'held' | 'did_not_happen' | null;
  readonly version: number;
  readonly walkInCount: number;
  readonly roster: readonly RosterMember[];
  readonly registeredAttended: number;
  readonly totalAttended: number;
}

const CLOSEOUT_REFUSALS: Record<string, [string, string]> = {
  not_host: ['closeout_not_host', 'Only the host may close this gathering'],
  not_ended: ['closeout_not_ended', 'This gathering has not finished yet'],
  no_end_time: [
    'closeout_no_end_time',
    'This gathering has no recorded end time',
  ],
  event_cancelled: [
    'closeout_event_cancelled',
    'A cancelled gathering cannot be closed out',
  ],
  already_closed: [
    'closeout_already_closed',
    'This gathering has already been closed out',
  ],
};

/**
 * Refuse when the market has not turned community operations on.
 *
 * §5 gates every closeout surface, mutation and prompt on `communityOperations`, and the gate lives
 * on the server rather than on whether a screen was rendered: a flag that only hides a button is not
 * a flag, it is a layout choice. `communityOperationsEnabled` is CO-03's reader and already treats
 * an absent key and an unknown market as off.
 */
const requireOperationsEnabled = async (
  db: Db,
  marketCode: string,
): Promise<AppError | null> =>
  (await communityOperationsEnabled(db, marketCode))
    ? null
    : new AppError(
        'operations_disabled',
        'Community operations are not enabled in this market',
      );

/**
 * What the host needs to close a gathering out, and what they already recorded.
 *
 * Reads rather than decides: the refusals that matter are enforced by the write, which evaluates
 * them in the same statement. This exists so the form can be built from the real roster and show
 * existing marks, not so it can pre-authorise anything.
 *
 * The two totals are derived here and never accepted from a client. §5.5 makes every closeout count
 * derived, so `registeredAttended` is counted from the rows and `totalAttended` adds the walk-ins —
 * a host cannot submit a number that disagrees with the outcomes recorded, because no number is
 * submitted.
 */
export const readCloseout = async (
  db: Db,
  opts: { eventId: string; actorId: string },
): Promise<Result<CloseoutView>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (event.hostId !== opts.actorId)
    return err(
      new AppError(
        'closeout_not_host',
        'Only the host may close this gathering',
      ),
    );

  const disabled = await requireOperationsEnabled(db, event.marketCode);
  if (disabled) return err(disabled);

  const closeout = await getCloseout(db, opts.eventId);
  const roster = await listCloseoutRoster(db, { eventId: opts.eventId });
  const registeredAttended = roster.filter(
    (member) => member.outcome === 'attended',
  ).length;
  const walkInCount = closeout?.walkInCount ?? 0;

  return ok({
    eventId: opts.eventId,
    outcome: closeout?.outcome ?? null,
    version: closeout?.version ?? 0,
    walkInCount,
    roster,
    registeredAttended,
    totalAttended: registeredAttended + walkInCount,
  });
};

/**
 * Close the gathering out, and record who came in the same pass.
 *
 * The closeout is written first and the attendance after, because `recordAttendance`'s own guard
 * requires the event to be over and hosted by the actor — the same conditions the closeout write
 * evaluated — and a marking that lands without a closeout is an orphan that no reader joins.
 *
 * A gathering that did not happen records nobody and tells everybody: the frozen going set is
 * notified once each, idempotently, and no attendance row is written. The notice goes out after the
 * closeout is durable, so a failure to reach people cannot leave the outcome unrecorded — the
 * opposite order would make the product's own memory hostage to a notification.
 *
 * Marks are applied one row at a time on purpose. Each carries its own audit entry and its own
 * eligibility guard, and a batch that failed halfway would leave a closeout with a partial roster
 * and no record of which half. A refused mark is reported rather than thrown: the outcome is the
 * host's to see, and a name that slipped out of the going set between the form loading and this
 * call is a thing to say plainly, not a reason to lose the closeout.
 */
export const submitCloseoutResolver = async (
  db: Db,
  opts: {
    actorId: string;
    input: operations.SubmitCloseoutInput;
    attendance: readonly { userId: string; outcome: 'attended' | 'no_show' }[];
  },
): Promise<Result<{ refusedMarks: readonly string[] }>> => {
  const event = await getEvent(db, opts.input.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));

  const disabled = await requireOperationsEnabled(db, event.marketCode);
  if (disabled) return err(disabled);

  const result = await submitCloseout(db, {
    eventId: opts.input.eventId,
    actorId: opts.actorId,
    outcome: opts.input.outcome,
    walkInCount: opts.input.walkInCount,
    wouldHostAgain: opts.input.wouldHostAgain,
    hostFriction: opts.input.hostFriction,
    privateNote: opts.input.privateNote,
    auditId: id('aud'),
  });

  if (result.outcome !== 'submitted') {
    const [code, message] = CLOSEOUT_REFUSALS[result.outcome] ?? [
      'closeout_failed',
      'This gathering could not be closed out',
    ];
    return err(new AppError(code, message));
  }

  if (opts.input.outcome === 'did_not_happen') {
    await enqueueDidNotHappenNotices(db, {
      id: event.id,
      hostId: event.hostId,
      marketCode: event.marketCode,
      title: event.title,
      venue: event.venue,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    });
    return ok({ refusedMarks: [] });
  }

  const refusedMarks: string[] = [];
  for (const mark of opts.attendance) {
    const written = await recordAttendance(db, {
      eventId: opts.input.eventId,
      userId: mark.userId,
      hostId: opts.actorId,
      outcome: mark.outcome,
      rowId: id('att'),
      auditId: id('aud'),
    });
    if (written.outcome !== 'recorded') refusedMarks.push(mark.userId);
  }

  return ok({ refusedMarks });
};

/**
 * Rewrite a closeout an operator has decided is wrong.
 *
 * The one path that bypasses "only the host may submit", and the reason the permission is
 * `closeout:override` rather than anything a host holds: this changes the record of whether a
 * gathering happened, which every attendance figure and trust signal is derived from.
 *
 * The caller's permission is **not** checked here. It is checked by the admin surface that reaches
 * this, because that is the origin Cloudflare Access stands in front of and where the correlated
 * operator identity exists — a member-facing server function must never be able to call this, and
 * the way to guarantee that is to keep it out of the public `apps/ui` barrel rather than to add a
 * role comparison a caller could be wired around.
 *
 * `expectedVersion` is the concurrency guard: two operators correcting the same closeout without it
 * is last-write-wins over evidence. A stale version is reported rather than merged, because merging
 * two disagreeing accounts of the same evening produces a third that nobody asserted.
 *
 * The reason is required by the schema and lands in the audit entry, so a correction is never
 * anonymous.
 */
export const correctCloseoutResolver = async (
  db: Db,
  opts: {
    actorId: string;
    accessSubject?: string | null;
    input: operations.CorrectCloseoutInput;
  },
): Promise<Result<{ version: number }>> => {
  const event = await getEvent(db, opts.input.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));

  const result = await correctCloseout(db, {
    eventId: opts.input.eventId,
    expectedVersion: opts.input.expectedVersion,
    actorId: opts.actorId,
    accessSubject: opts.accessSubject ?? null,
    outcome: opts.input.outcome,
    walkInCount: opts.input.walkInCount,
    wouldHostAgain: opts.input.wouldHostAgain,
    hostFriction: opts.input.hostFriction,
    reason: opts.input.reason,
    auditId: id('aud'),
  });

  if (result.outcome === 'stale_version')
    return err(
      new AppError(
        'closeout_stale_version',
        'Somebody else changed this closeout first',
      ),
    );
  if (result.outcome === 'not_closed')
    return err(
      new AppError(
        'closeout_not_closed',
        'This gathering has no closeout to correct',
      ),
    );

  return ok({ version: result.row?.version ?? opts.input.expectedVersion + 1 });
};
