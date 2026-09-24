import {
  TELEGRAM_GROUP_POST_KEYS,
  type TelegramGroupPostKey,
} from '@founders-coffee/core';
import {
  forgetTelegramAccount,
  getTelegramGroup,
  NOTIFICATION_MAX_ATTEMPTS,
  type Db,
  type EventTelegramGroupRow,
  type ScheduledNotification,
} from '@founders-coffee/db';
import type { notifications } from '@founders-coffee/domain';
import type { TelegramBotProvider } from '@founders-coffee/notifications';
import { logger } from '@founders-coffee/observability';

import type { DispatchOutcome, Dispatcher } from './dispatch-outcome.js';
import {
  chatSession,
  closeGroup,
  firstRefusal,
  leaveChat,
  pinDetails,
  post,
  refusedPermanently,
  removeMember,
  revokeLinks,
  type Session,
  type Step,
} from './telegram-steps.js';

type Payload = notifications.TelegramNotificationPayload;

const sent: DispatchOutcome = { kind: 'sent' };

const CLOSING: readonly TelegramGroupPostKey[] = [
  'telegram_cancelled',
  'telegram_wrap_up',
];

const isGroupPost = (key: string): key is TelegramGroupPostKey =>
  (TELEGRAM_GROUP_POST_KEYS as readonly string[]).includes(key);

const isLastTry = (notification: ScheduledNotification): boolean =>
  notification.attempts + 1 >= NOTIFICATION_MAX_ATTEMPTS;

/**
 * Whether a post may still go up in the meetup's group.
 *
 * The group has to be live. The one exception is a retry of a post that closes the group, which
 * closes it before anything else and so finds it closed by its own first try. A disconnection in
 * between withdraws that retry before it runs, so the exception cannot reach a group the host let go.
 */
const isPostable = (
  group: EventTelegramGroupRow | undefined,
  notification: ScheduledNotification,
  key: TelegramGroupPostKey,
): group is EventTelegramGroupRow & { chatId: number } =>
  group !== undefined &&
  group.chatId !== null &&
  (group.status === 'active' ||
    (group.status === 'closed' &&
      CLOSING.includes(key) &&
      notification.attempts > 0));

/**
 * Close the group, post the last word, and leave.
 *
 * The cancellation rewrites the pin as well, so it stops promising the meetup. Leaving is last and
 * best-effort: the group is closed by then, so a bot that stays does nothing more there, and failing
 * the row would only post the goodbye again.
 */
const closeWith = async (
  db: Db,
  telegram: TelegramBotProvider,
  notification: ScheduledNotification,
  steps: {
    readonly session: Session;
    readonly group: EventTelegramGroupRow;
    readonly pinned: () => Promise<Step>;
    readonly posted: () => Promise<Step>;
    readonly now: Date;
  },
): Promise<DispatchOutcome> => {
  const closed = () =>
    closeGroup(db, telegram, steps.session, steps.group, {
      now: steps.now,
      lastTry: isLastTry(notification),
    });
  const refusal = await firstRefusal(
    notification.templateKey === 'telegram_cancelled'
      ? [closed, steps.pinned, steps.posted]
      : [closed, steps.posted],
  );
  if (refusal) return refusal;
  const left = await leaveChat(db, telegram, steps.session);
  if (left?.kind === 'failed')
    logger.warn('telegram.leave_failed', {
      id: notification.id,
      eventId: notification.eventId,
      reason: left.error,
    });
  return sent;
};

const inGroup = async (
  db: Db,
  telegram: TelegramBotProvider,
  notification: ScheduledNotification,
  key: TelegramGroupPostKey,
  payload: Payload,
): Promise<DispatchOutcome> => {
  const group = await getTelegramGroup(db, notification.eventId);
  if (!isPostable(group, notification, key))
    return refusedPermanently(
      'telegram_group_closed: the meetup has no live group',
    );
  const now = new Date();
  const session = chatSession(db, group.chatId, now);
  const pinned = () =>
    pinDetails(db, telegram, session, group, payload.telegramPinnedText, now);
  const posted = () => post(telegram, session, payload.telegramText);
  switch (key) {
    case 'telegram_details':
      return (await pinned()) ?? sent;
    case 'telegram_reminder':
      return (await posted()) ?? sent;
    case 'telegram_rescheduled':
    case 'telegram_relocated':
      return (await firstRefusal([pinned, posted])) ?? sent;
    case 'telegram_cancelled':
    case 'telegram_wrap_up':
      return closeWith(db, telegram, notification, {
        session,
        group,
        pinned,
        posted,
        now,
      });
  }
};

/**
 * Take a member out, and forget their Telegram account once nothing will try again.
 *
 * The account id was copied onto the row only so the removal could be made. Once it is made, or
 * refused for good, or refused on the row's last try, the id has no further use and is dropped.
 */
const withdraw = async (
  db: Db,
  telegram: TelegramBotProvider,
  notification: ScheduledNotification,
  session: Session,
  payload: Payload,
): Promise<DispatchOutcome> => {
  const refusal = await removeMember(db, telegram, session, payload);
  const settled =
    refusal?.kind !== 'failed' || refusal.permanent || isLastTry(notification);
  if (settled && payload.telegramUserId !== undefined)
    await forgetTelegramAccount(db, notification.id);
  return refusal ?? sent;
};

const inNamedChat = async (
  db: Db,
  telegram: TelegramBotProvider,
  notification: ScheduledNotification,
  payload: Payload,
): Promise<DispatchOutcome> => {
  if (payload.telegramChatId === undefined)
    return refusedPermanently('telegram_payload_incomplete: no chat named');
  const session = chatSession(db, payload.telegramChatId, new Date());
  if (notification.templateKey === 'telegram_member_removed')
    return withdraw(db, telegram, notification, session, payload);
  const refusal = await firstRefusal([
    () => revokeLinks(telegram, session, payload.telegramInviteLinks ?? []),
    () => leaveChat(db, telegram, session),
  ]);
  return refusal ?? sent;
};

/**
 * Do one of the bot's queued jobs in a meetup's Telegram group.
 *
 * Most rows are posts to the meetup's group, and they go to whatever chat the group is in when they
 * run, provided it is still live. A departure and a member's removal instead name the chat they were
 * queued for, and the links to revoke there, because the host may have moved the meetup to another
 * group since.
 *
 * Each row is written so that running it again is safe. Nothing is ever posted twice on a retry: a
 * post is always the last call that can fail, and the pinned message is edited in place. Telegram's
 * refusals map onto the sweep's outcomes: a rate limit or an outage is retried, and everything else
 * is final.
 */
export const telegramDispatcher =
  (db: Db, telegram: TelegramBotProvider): Dispatcher =>
  async (notification, parsed) => {
    if (parsed.channel !== 'telegram')
      return refusedPermanently(`channel_mismatch: ${parsed.channel}`);
    const key = notification.templateKey;
    if (key === 'telegram_disconnected' || key === 'telegram_member_removed')
      return inNamedChat(db, telegram, notification, parsed.payload);
    if (!isGroupPost(key))
      return refusedPermanently(`template_mismatch: ${key}`);
    return inGroup(db, telegram, notification, key, parsed.payload);
  };
