import { id } from '@founders-coffee/core';
import {
  openCityWaitlistLaunch,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import { alertFailure, WAITLIST_LAUNCH_FAILED_METRIC } from '../alerts.js';
import { workerEnv } from '../env.js';

/**
 * Write the meetup's notice round, or report why it could not be written.
 *
 * A round that was never written leaves nothing for the recovery sweep to find, so its failure is
 * alerted as well as logged: that city's waitlist would otherwise hear nothing about this meetup.
 */
const openRound = async (
  db: Db,
  event: Event,
  launchId: string,
): Promise<boolean> => {
  try {
    const { written } = await openCityWaitlistLaunch(db, {
      id: launchId,
      eventId: event.id,
      marketCode: event.marketCode,
      cityCode: event.cityCode,
      now: new Date(),
    });
    return written;
  } catch (error) {
    logger.error('waitlist.launch_open_failed', {
      eventId: event.id,
      marketCode: event.marketCode,
      cityCode: event.cityCode,
      message: error instanceof Error ? error.message : String(error),
    });
    alertFailure(WAITLIST_LAUNCH_FAILED_METRIC, event.marketCode);
    return false;
  }
};

/**
 * Tell a newly published meetup's city waitlist about it, without ever being able to undo the meetup.
 *
 * Best-effort by construction, like the closeout intent beside it: the event is durable before this
 * runs, so nothing here throws back into the host's request. The round row is written first and is
 * the durable half; the queue message only makes delivery immediate. A message the queue refuses,
 * or a binding absent where this runs, costs a delay rather than the notice, because the worker's
 * recovery sweep delivers every round still pending.
 *
 * Called from `createEventWithTelemetry` for the reason `scheduleEventCloseoutPrompt` is: this
 * reaches `cloudflare:workers`, which the browser bundle must never import.
 */
export const scheduleCityWaitlistLaunch = async (
  db: Db,
  event: Event,
): Promise<void> => {
  const launchId = id('wll');
  if (!(await openRound(db, event, launchId))) return;

  const queue = workerEnv().NOTIFICATIONS;
  const context = { launchId, eventId: event.id, marketCode: event.marketCode };
  if (!queue) {
    logger.warn('waitlist.launch_queue_unbound', context);
    return;
  }
  try {
    await queue.send({
      kind: 'waitlist_launch_due',
      launchId,
      eventId: event.id,
    });
  } catch (error) {
    logger.warn('waitlist.launch_enqueue_failed', {
      ...context,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
