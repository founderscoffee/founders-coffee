import {
  AppError,
  err,
  ok,
  type Result,
  type WaitlistLaunchDueMessage,
} from '@founders-coffee/core';
import {
  beginCityWaitlistNotificationDispatch,
  cancelCityWaitlistLaunch,
  claimCityWaitlistNotifications,
  completeCityWaitlistLaunchIfDrained,
  deleteExpiredWaitlistEntries,
  fanOutCityWaitlistLaunch,
  getCityWaitlistLaunch,
  getEvent,
  listPendingCityWaitlistLaunches,
  listStaleCityWaitlistNotifications,
  listWaitlistRecipients,
  markCityWaitlistNotificationFailed,
  markCityWaitlistNotificationSent,
  nextCityWaitlistAttempt,
  type CityWaitlistLaunchRow,
  type CityWaitlistNotificationRow,
  type Db,
  type Event,
} from '@founders-coffee/db';
import type { EmailProvider } from '@founders-coffee/email';
import type { Locale } from '@founders-coffee/i18n';
import { logger } from '@founders-coffee/observability';
import { waitlistLaunchEmails } from '@founders-coffee/server-fns/waitlist-launch';

import { deleteInPasses } from './retention.js';

const BATCH_SIZE = 50;
const SWEEP_LAUNCHES = 20;

export interface WaitlistLaunchDeps {
  readonly email: EmailProvider;
  readonly requeue?: (
    message: WaitlistLaunchDueMessage,
    delaySeconds: number,
  ) => Promise<void>;
}

type LaunchEmails = ReturnType<typeof waitlistLaunchEmails>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Whether a round's meetup can still be announced: published, and not yet started. A waitlist is
 * promised a meetup it can go to, so a cancelled or past one withdraws the round instead.
 */
const isAnnounceable = (event: Event | undefined, now: Date): event is Event =>
  event !== undefined &&
  event.status === 'published' &&
  event.startsAt.getTime() > now.getTime();

/**
 * Release the round's claims abandoned by an invocation that died. A notice never handed to the
 * provider is retried; one that might have been is failed for good, so an unconfirmed send is never
 * sent a second time.
 */
const recoverStaleClaims = async (
  db: Db,
  launchId: string,
  now: Date,
): Promise<void> => {
  const stale = await listStaleCityWaitlistNotifications(db, {
    launchId,
    limit: BATCH_SIZE,
    now,
  });
  for (const notification of stale) {
    const dispatched = notification.dispatchStartedAt !== null;
    await markCityWaitlistNotificationFailed(db, {
      id: notification.id,
      error: dispatched ? 'dispatch_unconfirmed' : 'claim_expired',
      now,
      permanent: dispatched,
    });
  }
};

/**
 * Send one claimed notice and record the outcome.
 *
 * The message is rendered before the dispatch is recorded, so a rendering failure is retried like
 * any other. A notice whose claim the meetup's cancellation took back is left alone unsent.
 */
const deliver = async (
  db: Db,
  notification: CityWaitlistNotificationRow,
  recipient: { email: string; locale: Locale } | undefined,
  emails: LaunchEmails,
  deps: WaitlistLaunchDeps,
  now: Date,
): Promise<void> => {
  const fail = (error: string, permanent = false) =>
    markCityWaitlistNotificationFailed(db, {
      id: notification.id,
      error,
      now,
      permanent,
    });
  if (!recipient) return fail('waitlist_entry_missing', true);

  const payload = await emails(recipient.locale).then(ok, (error: unknown) =>
    err(new AppError('waitlist_render_failed', errorMessage(error))),
  );
  if (!payload.ok) return fail(payload.error.message);
  if (
    !(await beginCityWaitlistNotificationDispatch(db, {
      id: notification.id,
      now,
    }))
  )
    return;

  try {
    const sent = await deps.email.send({
      to: recipient.email,
      ...payload.data,
    });
    if (sent.ok)
      return markCityWaitlistNotificationSent(db, {
        id: notification.id,
        waitlistId: notification.waitlistId,
        now,
      });
    return fail(sent.error.message);
  } catch (error) {
    return fail(errorMessage(error));
  }
};

/**
 * Hand the round back to the queue for its next due notice: at once while more are due, or when
 * the earliest retry comes up. Without a queue, the recovery sweep carries it on instead. A round
 * with only notices in flight elsewhere is finished by whichever invocation holds them.
 */
const continueLater = async (
  db: Db,
  launch: CityWaitlistLaunchRow,
  deps: WaitlistLaunchDeps,
  now: Date,
): Promise<void> => {
  if (!deps.requeue) return;
  const { nextAttemptAt } = await nextCityWaitlistAttempt(db, launch.id);
  if (nextAttemptAt === null) return;
  const delaySeconds = Math.max(
    0,
    Math.ceil((nextAttemptAt.getTime() - now.getTime()) / 1000),
  );
  await deps.requeue(
    {
      kind: 'waitlist_launch_due',
      launchId: launch.id,
      eventId: launch.eventId,
    },
    delaySeconds,
  );
};

/**
 * Work one round forward: write a notice for everyone the city still owes one, send a batch of the
 * due ones, and either complete the round or schedule its next pass.
 */
const resolveLaunch = async (
  db: Db,
  launch: CityWaitlistLaunchRow,
  deps: WaitlistLaunchDeps,
  now: Date,
): Promise<void> => {
  const event = await getEvent(db, launch.eventId);
  if (!isAnnounceable(event, now)) {
    await cancelCityWaitlistLaunch(db, launch.eventId, now);
    logger.info('waitlist.launch_withdrawn', {
      launchId: launch.id,
      eventId: launch.eventId,
      marketCode: launch.marketCode,
    });
    return;
  }

  await fanOutCityWaitlistLaunch(db, {
    launchId: launch.id,
    marketCode: launch.marketCode,
    cityCode: launch.cityCode,
    now,
  });
  await recoverStaleClaims(db, launch.id, now);
  const claimed = await claimCityWaitlistNotifications(db, {
    launchId: launch.id,
    limit: BATCH_SIZE,
    now,
  });
  const recipients = await listWaitlistRecipients(
    db,
    claimed.map((notification) => notification.waitlistId),
  );
  const emails = waitlistLaunchEmails(db, event);
  for (const notification of claimed)
    await deliver(
      db,
      notification,
      recipients.get(notification.waitlistId),
      emails,
      deps,
      now,
    );

  if (await completeCityWaitlistLaunchIfDrained(db, launch.id, now)) {
    logger.info('waitlist.launch_completed', {
      launchId: launch.id,
      eventId: launch.eventId,
      marketCode: launch.marketCode,
    });
    return;
  }
  await continueLater(db, launch, deps, now);
};

/**
 * Consume one `waitlist_launch_due` message. A round that no longer exists, is already closed, or
 * belongs to another meetup is acknowledged as done; a database failure is returned so the queue
 * retries the message.
 */
export const processWaitlistLaunch = async (
  db: Db,
  message: WaitlistLaunchDueMessage,
  deps: WaitlistLaunchDeps,
): Promise<Result<{ launchId: string }>> => {
  try {
    const launch = await getCityWaitlistLaunch(db, message.launchId);
    if (launch?.status === 'pending' && launch.eventId === message.eventId)
      await resolveLaunch(db, launch, deps, new Date());
    return ok({ launchId: message.launchId });
  } catch (error) {
    logger.error('waitlist.launch_failed', {
      launchId: message.launchId,
      eventId: message.eventId,
      message: errorMessage(error),
    });
    return err(new AppError('waitlist_launch_failed', errorMessage(error)));
  }
};

/**
 * The recovery half of delivery, run every fifteen minutes: the rounds still pending, oldest first,
 * whatever left them there — a queue binding absent where the meetup was created, a message that
 * exhausted its retries, or a claim abandoned by an invocation that died.
 */
export const sweepWaitlistLaunches = async (
  db: Db,
  deps: WaitlistLaunchDeps,
): Promise<void> => {
  const now = new Date();
  for (const launch of await listPendingCityWaitlistLaunches(
    db,
    SWEEP_LAUNCHES,
  )) {
    try {
      await resolveLaunch(db, launch, deps, now);
    } catch (error) {
      logger.error('waitlist.launch_failed', {
        launchId: launch.id,
        eventId: launch.eventId,
        message: errorMessage(error),
      });
    }
  }
};

/**
 * The daily retention sweep AGENTS.md §11.5 allows (#106): delete the waitlist entries whose notice
 * went out more than twelve months ago, in bounded batches read through the `notified_at` index.
 */
export const sweepExpiredWaitlistEntries = async (db: Db): Promise<number> => {
  const now = new Date();
  const deleted = await deleteInPasses((limit) =>
    deleteExpiredWaitlistEntries(db, { now, limit }),
  );
  if (deleted > 0) logger.info('waitlist.retention_sweep', { deleted });
  return deleted;
};
