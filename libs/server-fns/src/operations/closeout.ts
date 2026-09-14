import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  getCloseout,
  getEvent,
  recordAttendance,
  submitCloseout,
  type Db,
} from '@founders-coffee/db';
import type { operations } from '@founders-coffee/domain';

import { enqueueDidNotHappenNotices } from '../notifications/did-not-happen.js';
import { enqueueFeedbackInvitations } from '../notifications/feedback-invitation.js';
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
 * One refusal is made here as well as in the write, and deliberately: an event with no recorded
 * `ends_at` can never be closed out, and letting the form render for it means a host fills in a
 * roster, walk-ins and friction, submits, and is told to try again — advice that can never succeed.
 * A permanent no belongs before the work, not after it.
 *
 * Otherwise this reads rather than decides: the refusals that matter are enforced by the write, which
 * evaluates them in the same statement. This exists so the form can be built from the real roster and show
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

  if (!event.endsAt)
    return err(
      new AppError(
        'closeout_no_end_time',
        'This gathering has no recorded end time',
      ),
    );

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
 * Whether an "already closed" is a second submission to refuse or a half-finished one to complete.
 *
 * The stored outcome has to agree with the one being submitted. A host pressing submit again after
 * an error is resuming; a host submitting a different answer is trying to rewrite the record of
 * whether a gathering happened, which is `correctCloseout`'s job and carries an operator permission
 * and a reason. The two look identical at this call site and must not be treated alike.
 */
const resumesTheSameCloseout = async (
  db: Db,
  eventId: string,
  outcome: 'held' | 'did_not_happen',
): Promise<boolean> => (await getCloseout(db, eventId))?.outcome === outcome;

/**
 * Close the gathering out, and record who came in the same pass.
 *
 * The closeout is written first and the attendance after, because `recordAttendance`'s own guard
 * requires the event to be over and hosted by the actor — the same conditions the closeout write
 * evaluated — and a marking that lands without a closeout is an orphan that no reader joins.
 *
 * That ordering means the submission is not one transaction, and D1 offers none that could make it
 * so: there are no interactive transactions, and two hundred marks is not a batch. So the work after
 * the closeout is made **resumable** instead. Every write past this point is idempotent — attendance
 * on `ON CONFLICT DO UPDATE`, notices on an id derived from the (event, member) pair — and an
 * `already_closed` whose stored outcome matches is therefore not a refusal but an instruction to
 * finish. Without that, a failure partway through the roster was permanent: the marks that landed
 * stayed, the rest could never be written, and the retry that would have repaired it was refused as
 * a duplicate.
 *
 * A gathering that did not happen records nobody and tells everybody: the frozen going set is
 * notified once each, idempotently, and no attendance row is written. The notice goes out after the
 * closeout is durable, so a failure to reach people cannot leave the outcome unrecorded — the
 * opposite order would make the product's own memory hostage to a notification. A fan-out that dies
 * partway is resumed by the same path, and by the nightly backfill if the host never returns.
 *
 * Marks are applied one row at a time on purpose, and not for the reason this comment used to give:
 * a D1 batch is atomic, so one that failed would leave nothing rather than half a roster. The real
 * reasons are that each mark has its own eligibility guard whose refusal has to be reported by name,
 * and that the domain's two-hundred cap is a batch nobody should build. A refused mark is reported
 * rather than thrown: a name that slipped out of the going set between the form loading and this
 * call is a thing to say plainly, not a reason to lose the closeout.
 *
 * A throw from inside the loop is deliberately not caught. Swallowing it would answer `ok` with a
 * roster that was never written, telling the host the work is done; letting it out means the host
 * sees a failure and the retry completes what is missing.
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
    const resuming =
      result.outcome === 'already_closed' &&
      (await resumesTheSameCloseout(
        db,
        opts.input.eventId,
        opts.input.outcome,
      ));
    if (!resuming) {
      const [code, message] = CLOSEOUT_REFUSALS[result.outcome] ?? [
        'closeout_failed',
        'This gathering could not be closed out',
      ];
      return err(new AppError(code, message));
    }
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

  await enqueueFeedbackInvitations(db, event);

  return ok({ refusedMarks });
};
