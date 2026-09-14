import { operations } from '@founders-coffee/domain';
import { listEventsMissingCloseoutPrompt, type Db } from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';
import { enqueueCloseoutPrompt } from '@founders-coffee/server-fns/closeout-prompt';

export const CLOSEOUT_BACKFILL_LIMIT = 200;

export interface BackfillTally {
  readonly examined: number;
  readonly scheduled: number;
  readonly skipped: number;
  readonly failed: number;
}

/**
 * Give a closeout prompt to every ended gathering that has not got one.
 *
 * The recovery half of CO-05, and what makes the creation hook safe to swallow its own failures: an
 * intent that was never written, or was written before this feature existed, is derived here from
 * `events` anti-joined against the prompt rows themselves.
 *
 * Each event is scheduled in its own try, so one unschedulable row does not end the night's work for
 * the rest. The enqueue is idempotent on a derived id, so a row this pass writes and a row the
 * creation hook wrote a second earlier are the same row rather than two.
 *
 * Bounded at 200. A backlog larger than that is scheduled over consecutive nights instead of in one
 * write storm, and the tally is logged so a backlog that never clears is visible rather than
 * inferred.
 */
export const backfillCloseoutPrompts = async (
  db: Db,
  now = new Date(),
): Promise<BackfillTally> => {
  const candidates = await listEventsMissingCloseoutPrompt(db, {
    endedAfter: new Date(
      now.getTime() - operations.CLOSEOUT_PROMPT_BACKFILL_WINDOW_MS,
    ),
    endsBefore: now,
    limit: CLOSEOUT_BACKFILL_LIMIT,
  });

  let scheduled = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of candidates) {
    try {
      const outcome = await enqueueCloseoutPrompt(db, event);
      if (outcome === 'scheduled') scheduled += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      logger.error('closeout_prompt_backfill_failed', {
        eventId: event.id,
        message: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const tally = { examined: candidates.length, scheduled, skipped, failed };
  logger.info('closeout_prompt_backfill', tally);
  return tally;
};
