import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';
import { logger } from '@founders-coffee/observability';

import { alertFailure, SCHEDULE_ARM_FAILED_METRIC } from '../alerts.js';
import { workerEnv } from '../env.js';

interface ScheduleStub {
  arm: (opts: { eventId: string; sendAtMs: number }) => Promise<void>;
}

/**
 * Wake one event's scheduler, swallowing any reason it could not be woken.
 *
 * Separate from the caller below so it can be exercised against a stub namespace: the object itself
 * belongs to `apps/worker-jobs` and reaches this app only as a cross-script binding, which no test
 * in this library can construct.
 *
 * Failure is logged, not raised. The Durable Object is a latency optimisation over a table that is
 * already durable, and a scheduler that is unreachable must not turn a successful RSVP into a
 * failed one — the member is going to the meetup either way, and the recovery sweep still carries
 * the confirmation.
 *
 * It is also counted, because a log nobody watches is not an alert. Every arm failing is invisible
 * from the outside — the sweep keeps delivering, fifteen minutes late — so the counter is the only
 * thing that would distinguish a healthy deployment from one running entirely on its safety net.
 */
export const armOn = async (
  namespace: DurableObjectNamespace,
  eventId: string,
  sendAt: Date,
): Promise<void> => {
  try {
    const stub = namespace.get(namespace.idFromName(eventId), {
      locationHint: DURABLE_OBJECT_LOCATION_HINT,
    }) as unknown as ScheduleStub;
    await stub.arm({ eventId, sendAtMs: sendAt.getTime() });
  } catch (error) {
    logger.error('notification.schedule_arm_failed', {
      eventId,
      reason: error instanceof Error ? error.message : String(error),
    });
    alertFailure(SCHEDULE_ARM_FAILED_METRIC);
  }
};

/**
 * Point this event's scheduler at a notification that was just written.
 *
 * Called after the rows land, never before: the object rearms itself from the table when it fires,
 * so an alarm set for a row that has not been inserted yet finds nothing and goes back to sleep
 * until the recovery sweep. Writing first and arming second cannot lose a notification — at worst
 * the arm fails and the sweep delivers it late.
 *
 * An absent binding is not an error and is not logged: `wrangler dev` and every test in this
 * library run without it, and the recovery sweep is what delivers there.
 */
export const armNotificationSchedule = async (
  eventId: string,
  sendAt: Date,
): Promise<void> => {
  const namespace = workerEnv().NOTIFICATION_SCHEDULE;
  if (namespace) await armOn(namespace, eventId, sendAt);
};
