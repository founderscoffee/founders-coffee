import {
  eraseClosedAccount,
  listClosingAccounts,
  listProfileAssetPrefixes,
  listUnfinishedHostedEvents,
  listUpcomingRsvpEvents,
  type ClosingAccount,
  type Db,
} from '@founders-coffee/db';
import type { PhotoStore } from '@founders-coffee/infra';
import { logger, reportError } from '@founders-coffee/observability';

import { cancelEventResolver } from '../events/cancel.js';
import { cancelRsvpResolver } from '../rsvps/resolver.js';

export type AccountClosureOutcome = 'erased' | 'waiting_on_meetup' | 'reopened';

export interface AccountClosureSweep {
  readonly erased: number;
  readonly waiting: number;
  readonly reopened: number;
  readonly failed: number;
}

const DAY_MS = 86_400_000;
const OVERDUE_DAYS = 25;

const leaveHostedMeetups = async (
  db: Db,
  account: ClosingAccount,
  now: Date,
): Promise<boolean> => {
  const unfinished = await listUnfinishedHostedEvents(db, {
    userId: account.id,
    now,
  });
  for (const event of unfinished.filter((row) => row.startsAt > now)) {
    const result = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: account.id,
    });
    if (!result.ok)
      logger.warn('account_closure_cancel_refused', {
        userId: account.id,
        eventId: event.id,
        code: result.error.code,
      });
  }
  const left = await listUnfinishedHostedEvents(db, {
    userId: account.id,
    now,
  });
  return left.length === 0;
};

const leaveJoinedMeetups = async (
  db: Db,
  account: ClosingAccount,
  now: Date,
): Promise<void> => {
  const joined = await listUpcomingRsvpEvents(db, { userId: account.id, now });
  for (const eventId of joined) {
    const result = await cancelRsvpResolver(db, {
      eventId,
      userId: account.id,
    });
    if (!result.ok)
      logger.warn('account_closure_rsvp_refused', {
        userId: account.id,
        eventId,
        code: result.error.code,
      });
  }
};

/**
 * Carry one closing account as far towards erasure as it can go tonight (#105).
 *
 * First the member leaves what has not happened yet, the way they could have themselves: each
 * meetup they host that has not started is cancelled, with the notice to everyone going that a
 * host's own cancellation sends, and each seat they hold at someone else's meetup is given back.
 * A meetup of theirs that is under way waits for its end. Then their photos leave storage, because
 * the rows being erased are the only record of where they are, and the account is erased.
 *
 * Every step can run again, so a closure that waited or stopped partway finishes on a later night.
 */
export const carryAccountClosure = async (
  db: Db,
  account: ClosingAccount,
  photos: PhotoStore,
  now: Date = new Date(),
): Promise<AccountClosureOutcome> => {
  const isHostingDone = await leaveHostedMeetups(db, account, now);
  await leaveJoinedMeetups(db, account, now);
  if (!isHostingDone) return 'waiting_on_meetup';
  for (const prefix of await listProfileAssetPrefixes(db, account.id)) {
    await photos.deletePrefix(prefix);
  }
  return (await eraseClosedAccount(db, account, now)) ? 'erased' : 'reopened';
};

const isOverdue = (account: ClosingAccount, now: Date): boolean =>
  account.closedAt !== null &&
  now.getTime() - account.closedAt.getTime() > OVERDUE_DAYS * DAY_MS;

/**
 * Carry every account due for closure through {@link carryAccountClosure}, once a day.
 *
 * Each account is handled on its own, so one failure strands none of the rest, and none of them
 * reaches the jobs that run after this one. An account still waiting when the thirty days the
 * privacy policy promises are close to running out is logged as an error, for the operator to
 * look at before they do.
 */
export const sweepClosingAccounts = async (
  db: Db,
  photos: PhotoStore,
  now: Date = new Date(),
  limit = 20,
): Promise<AccountClosureSweep> => {
  const due = await listClosingAccounts(db, { now, limit });
  const tally = { erased: 0, waiting: 0, reopened: 0, failed: 0 };
  for (const account of due) {
    try {
      const outcome = await carryAccountClosure(db, account, photos, now);
      if (outcome === 'erased') tally.erased += 1;
      else if (outcome === 'reopened') tally.reopened += 1;
      else tally.waiting += 1;
      logger.info('account_closure', { userId: account.id, outcome });
      if (outcome.startsWith('waiting') && isOverdue(account, now))
        logger.error('account_closure_overdue', {
          userId: account.id,
          outcome,
          closedAt: account.closedAt?.toISOString(),
        });
    } catch (error) {
      tally.failed += 1;
      reportError(error, { operation: 'account_closure', userId: account.id });
    }
  }
  if (due.length > 0) logger.info('account_closure_sweep', tally);
  return tally;
};
