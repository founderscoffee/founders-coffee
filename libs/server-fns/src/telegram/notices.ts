import {
  id,
  TELEGRAM_TEMPLATE_KEYS,
  type TelegramTemplateKey,
} from '@founders-coffee/core';
import {
  ASSUMED_DURATION_SECONDS,
  cancelNotificationsByTemplate,
  enqueueNotification,
  getTelegramGroup,
  takeTelegramInvite,
  type Db,
  type Event,
} from '@founders-coffee/db';

import { validPayload } from '../notifications/producer.js';
import { armNotificationSchedule } from '../notifications/schedule.js';
import {
  telegramCancelledPinnedText,
  telegramCancelledText,
  telegramDetailsText,
  telegramRelocatedText,
  telegramReminderText,
  telegramRescheduledText,
  telegramValuesFor,
  telegramWrapUpText,
  type TelegramValues,
} from './texts.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const RETIMED: readonly TelegramTemplateKey[] = [
  'telegram_reminder',
  'telegram_wrap_up',
];

interface TelegramContent {
  readonly telegramText?: string;
  readonly telegramPinnedText?: string;
  readonly telegramUserId?: number;
  readonly telegramInviteLink?: string;
}

/**
 * When the bot says goodbye: a day after the meetup ends, or after it starts plus the two hours the
 * live room assumes when it has no end.
 */
export const telegramWrapUpAt = (
  event: Pick<Event, 'startsAt' | 'endsAt'>,
): Date =>
  new Date(
    (event.endsAt?.getTime() ??
      event.startsAt.getTime() + ASSUMED_DURATION_SECONDS * 1000) + DAY_MS,
  );

/**
 * Queue one thing for the bot to do in a meetup's group.
 *
 * Group posts go through the same table, alarm and sweep as personal notices, so they are retried,
 * claimed and accounted for the same way. The row is attributed to the host, whose group it is,
 * except a removal, which belongs to the member leaving. The text is written now, like every
 * notice's, which is why a change to the meetup rewrites the rows still waiting.
 */
const enqueueTelegram = async (
  db: Db,
  opts: {
    event: Event;
    values: TelegramValues;
    templateKey: TelegramTemplateKey;
    sendAt: Date;
    content: TelegramContent;
    userId?: string;
  },
): Promise<void> => {
  await enqueueNotification(db, {
    id: id('ntf'),
    eventId: opts.event.id,
    userId: opts.userId ?? opts.event.hostId,
    channel: 'telegram',
    templateKey: opts.templateKey,
    payload: validPayload('telegram', { ...opts.values.base, ...opts.content }),
    sendAt: opts.sendAt,
  });
};

const enqueueTimed = async (
  db: Db,
  event: Event,
  values: TelegramValues,
  now: Date,
): Promise<void> => {
  const reminderAt = new Date(event.startsAt.getTime() - DAY_MS);
  if (reminderAt > now)
    await enqueueTelegram(db, {
      event,
      values,
      templateKey: 'telegram_reminder',
      sendAt: reminderAt,
      content: { telegramText: telegramReminderText(values) },
    });
  await enqueueTelegram(db, {
    event,
    values,
    templateKey: 'telegram_wrap_up',
    sendAt: telegramWrapUpAt(event),
    content: { telegramText: telegramWrapUpText(values) },
  });
};

/**
 * Give a newly connected group everything the bot will post to it.
 *
 * The details go up and are pinned at once; the reminder is queued for a day before the start when
 * that moment is still ahead, and the goodbye for a day after the end. The alarm is armed for now,
 * and rearms itself for the later rows as each run finishes.
 */
export const scheduleTelegramGroup = async (
  db: Db,
  event: Event,
  now: Date = new Date(),
): Promise<void> => {
  const values = await telegramValuesFor(db, event);
  await enqueueTelegram(db, {
    event,
    values,
    templateKey: 'telegram_details',
    sendAt: now,
    content: { telegramPinnedText: telegramDetailsText(values) },
  });
  await enqueueTimed(db, event, values, now);
  await armNotificationSchedule(event.id, now);
};

const telegramTextsChanged = (before: Event, after: Event): boolean =>
  before.title !== after.title ||
  before.venue !== after.venue ||
  (before.venueAddress ?? null) !== (after.venueAddress ?? null) ||
  before.startsAt.getTime() !== after.startsAt.getTime() ||
  (before.endsAt?.getTime() ?? null) !== (after.endsAt?.getTime() ?? null);

/**
 * Bring a meetup's group in line with an edit that just landed.
 *
 * The reminder and the goodbye were written against the old meetup and timed from it, so they are
 * withdrawn and written again whenever anything they say or their timing depends on changed. Then
 * the group hears about the edit the way the members do: a change of time or place gets a post of
 * its own, with the pinned details rewritten beside it, and a quiet edit to the title or the
 * address only rewrites the pin, which Telegram does without notifying anyone.
 */
export const announceTelegramUpdate = async (
  db: Db,
  opts: {
    before: Event;
    after: Event;
    notice: 'event_rescheduled' | 'event_relocated' | null;
  },
  now: Date = new Date(),
): Promise<void> => {
  const group = await getTelegramGroup(db, opts.after.id);
  if (group?.status !== 'active') return;
  const changed = telegramTextsChanged(opts.before, opts.after);
  if (!changed && !opts.notice) return;

  const values = await telegramValuesFor(db, opts.after);
  if (changed) {
    await cancelNotificationsByTemplate(db, {
      eventId: opts.after.id,
      templateKeys: RETIMED,
    });
    await enqueueTimed(db, opts.after, values, now);
  }

  const pinned = { telegramPinnedText: telegramDetailsText(values) };
  if (opts.notice === 'event_rescheduled')
    await enqueueTelegram(db, {
      event: opts.after,
      values,
      templateKey: 'telegram_rescheduled',
      sendAt: now,
      content: { ...pinned, telegramText: telegramRescheduledText(values) },
    });
  else if (opts.notice === 'event_relocated')
    await enqueueTelegram(db, {
      event: opts.after,
      values,
      templateKey: 'telegram_relocated',
      sendAt: now,
      content: { ...pinned, telegramText: telegramRelocatedText(values) },
    });
  else
    await enqueueTelegram(db, {
      event: opts.after,
      values,
      templateKey: 'telegram_details',
      sendAt: now,
      content: pinned,
    });
  await armNotificationSchedule(opts.after.id, now);
};

/**
 * Tell a meetup's group it is off, and let the bot go.
 *
 * The caller has already withdrawn every pending row for the meetup, the group's reminder and
 * goodbye among them. The post carries the host's reason, the pin is rewritten so it no longer
 * promises the meetup, and the bot then closes the group: no more joins, and it leaves.
 */
export const announceTelegramCancellation = async (
  db: Db,
  opts: { event: Event; reason?: string },
  now: Date = new Date(),
): Promise<void> => {
  const group = await getTelegramGroup(db, opts.event.id);
  if (group?.status !== 'active') return;
  const values = await telegramValuesFor(db, opts.event);
  await enqueueTelegram(db, {
    event: opts.event,
    values,
    templateKey: 'telegram_cancelled',
    sendAt: now,
    content: {
      telegramText: telegramCancelledText(values, opts.reason),
      telegramPinnedText: telegramCancelledPinnedText(values),
    },
  });
  await armNotificationSchedule(opts.event.id, now);
};

/**
 * Hand a group back after its host disconnects it from the meetup.
 *
 * Nothing the bot had queued for the group is posted any more. The one row left makes it revoke the
 * meetup's invite links and leave, unless another of the host's meetups still uses the group.
 */
export const releaseTelegramGroup = async (
  db: Db,
  event: Event,
  now: Date = new Date(),
): Promise<void> => {
  await cancelNotificationsByTemplate(db, {
    eventId: event.id,
    templateKeys: TELEGRAM_TEMPLATE_KEYS,
  });
  const values = await telegramValuesFor(db, event);
  await enqueueTelegram(db, {
    event,
    values,
    templateKey: 'telegram_disconnected',
    sendAt: now,
    content: {},
  });
  await armNotificationSchedule(event.id, now);
};

/**
 * Take a member out of a meetup's group as their RSVP is withdrawn.
 *
 * Their invite is deleted at once, so the link admits nobody from this moment. The row that follows
 * removes the Telegram account that used it, if one did, and revokes the link itself. A member who
 * never asked for an invite, and the host, who holds none, leave nothing to do.
 */
export const withdrawTelegramMember = async (
  db: Db,
  opts: { event: Event; userId: string },
  now: Date = new Date(),
): Promise<void> => {
  const invite = await takeTelegramInvite(db, {
    eventId: opts.event.id,
    userId: opts.userId,
  });
  if (!invite) return;
  const group = await getTelegramGroup(db, opts.event.id);
  if (group?.status !== 'active') return;
  const values = await telegramValuesFor(db, opts.event);
  await enqueueTelegram(db, {
    event: opts.event,
    values,
    templateKey: 'telegram_member_removed',
    sendAt: now,
    userId: opts.userId,
    content: {
      telegramInviteLink: invite.inviteLink,
      ...(invite.telegramUserId === null
        ? {}
        : { telegramUserId: invite.telegramUserId }),
    },
  });
  await armNotificationSchedule(opts.event.id, now);
};
