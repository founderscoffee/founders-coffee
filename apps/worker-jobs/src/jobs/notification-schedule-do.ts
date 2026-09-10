import { DurableObject } from 'cloudflare:workers';

import { createDb, nextPendingSendAt } from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import type { NotificationDueMessage } from './messages.js';

interface ScheduleEnv {
  readonly DB: D1Database;
  readonly NOTIFICATIONS?: Queue<NotificationDueMessage>;
}

const EVENT_ID_KEY = 'eventId';

export const REARM_FLOOR_MS = 5 * 60 * 1000;

export class NotificationScheduleDO extends DurableObject<ScheduleEnv> {
  /**
   * Point this event's alarm at the moment its next notification is due.
   *
   * One object per event, named from the event id, so the alarm population scales with events in
   * flight rather than with time — which is the whole point of replacing the one-minute poll. A
   * poll asks the table sixty times an hour whether anything is due; an alarm asks nothing and
   * fires once, at the moment something is.
   *
   * Earliest wins. `setAlarm` keeps a single alarm per object, so arming for a 24-hour reminder
   * after arming for an immediate confirmation would push the confirmation past the reminder and
   * lose it. Every writer that adds a row calls this with that row's `send_at`, and only an
   * earlier time replaces what is already set; a later one is already covered, because firing
   * rearms from the table.
   *
   * A time in the past is armed as `now`: `setAlarm` accepts it and the runtime fires immediately,
   * which is what a confirmation enqueued for this instant wants.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC rejects arrow-field methods.
  async arm(opts: { eventId: string; sendAtMs: number }): Promise<void> {
    await this.ctx.storage.put(EVENT_ID_KEY, opts.eventId);
    const at = Math.max(opts.sendAtMs, Date.now());
    const existing = await this.ctx.storage.getAlarm();
    if (existing !== null && existing <= at) return;
    await this.ctx.storage.setAlarm(at);
  }

  /**
   * Hand this event to the Notifications Queue, then rearm for whatever is due next.
   *
   * The alarm produces a message and nothing else. Delivery is the consumer's job, so the object
   * holds no provider credentials, makes no outbound call that could keep it alive for seconds, and
   * cannot lose work to a provider timeout: the queue's retries and dead-letter queue are the
   * durability, exactly as they are for every other job this Worker runs.
   *
   * An unbound queue is logged rather than thrown. Throwing would retry the alarm against a binding
   * that cannot appear without a redeploy, and the recovery sweep delivers these rows anyway — but
   * a silent no-op here would look exactly like an event with nothing due, so it says so.
   *
   * Rearming reads the table rather than the object's memory — see `nextPendingSendAt`. It happens
   * after the send so that a queue failure surfaces as a thrown alarm, which the runtime retries
   * with backoff, instead of being swallowed by having already moved the pointer forward.
   *
   * The rearm is floored at five minutes out, and that floor is load-bearing rather than tidiness.
   * The consumer has not run yet at this point, so the rows just handed to the queue are still
   * `pending` and still due — rearming at their `send_at` would fire again immediately and keep
   * firing until the consumer happened to win the race. The floor turns that into a bounded retry:
   * an event whose message was lost or whose consumer is failing is re-announced every five
   * minutes, and one that was delivered rearms at the next reminder, hours away.
   *
   * An object whose event has nothing pending sets no alarm and goes idle. It is not deleted: the
   * name is derived from the event id, so a later RSVP reaches the same object and arms it again,
   * and an idle object with one stored key costs nothing worth a deletion path.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC rejects arrow-field methods.
  override async alarm(): Promise<void> {
    const eventId = await this.ctx.storage.get<string>(EVENT_ID_KEY);
    if (!eventId) return;

    if (!this.env.NOTIFICATIONS) {
      logger.error('notification.schedule_queue_unbound', { eventId });
    } else {
      await this.env.NOTIFICATIONS.send({ kind: 'notification_due', eventId });
    }

    const next = await nextPendingSendAt(createDb(this.env.DB), eventId);
    if (next)
      await this.ctx.storage.setAlarm(
        Math.max(next.getTime(), Date.now() + REARM_FLOOR_MS),
      );
  }
}
