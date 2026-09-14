import { operations } from '@founders-coffee/domain';
import {
  listEventsMissingDidNotHappenNotices,
  type Db,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';
import { enqueueDidNotHappenNotices } from '@founders-coffee/server-fns/did-not-happen';

export const DID_NOT_HAPPEN_BACKFILL_LIMIT = 100;

export interface NoticeBackfillTally {
  readonly examined: number;
  readonly notified: number;
  readonly failed: number;
}

/**
 * Tell the people a called-off gathering never reached.
 *
 * The fan-out in `submitCloseoutResolver` runs per member after the closeout is durable, so one that
 * dies partway leaves some told and the rest not. The host's retry resumes it — this covers the host
 * who never retries, which is the likelier case: they saw an error on a form about a meetup that did
 * not happen, and had no reason to come back.
 *
 * `enqueueDidNotHappenNotices` is idempotent per (event, member), so re-running it over an event
 * that is nine-tenths done writes the missing tenth and nothing else. That is what makes it safe to
 * call on whole events rather than tracking which member was missed.
 *
 * Each event is scheduled in its own try, so one unreachable row does not end the night's work.
 * Bounded at a hundred: a backlog larger than that is a fault worth seeing in the tally rather than
 * a write storm worth absorbing.
 */
export const backfillDidNotHappenNotices = async (
  db: Db,
  now = new Date(),
): Promise<NoticeBackfillTally> => {
  const candidates = await listEventsMissingDidNotHappenNotices(db, {
    endedAfter: new Date(
      now.getTime() - operations.DID_NOT_HAPPEN_BACKFILL_WINDOW_MS,
    ),
    limit: DID_NOT_HAPPEN_BACKFILL_LIMIT,
  });

  let notified = 0;
  let failed = 0;

  for (const event of candidates) {
    try {
      notified += await enqueueDidNotHappenNotices(db, event);
    } catch (error) {
      failed += 1;
      logger.error('did_not_happen_backfill_failed', {
        eventId: event.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const tally = { examined: candidates.length, notified, failed };
  logger.info('did_not_happen_backfill', tally);
  return tally;
};
