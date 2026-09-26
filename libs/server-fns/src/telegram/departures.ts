import { TELEGRAM_GROUP_POST_KEYS } from '@founders-coffee/core';
import {
  cancelNotificationsByTemplate,
  deleteTelegramInvites,
  getTelegramGroup,
  takeTelegramInvite,
  type Db,
  type Event,
} from '@founders-coffee/db';

import { armNotificationSchedule } from '../notifications/schedule.js';
import { enqueueTelegram } from './queue.js';
import { telegramValuesFor } from './texts.js';

/**
 * Hand a group back after its host disconnects it from the meetup.
 *
 * The caller has closed the group, so no join is admitted from here on. The meetup's invites go at
 * once, so a member asking again after a reconnection gets a link to the new group rather than the
 * old one, and none of the bot's queued posts go up any more. What is left names its own chat: a
 * member who cancelled just before is still taken out, and the row queued here revokes the links
 * the invites held and leaves the chat, because by the time it runs the host may have connected
 * the meetup somewhere else. The bot stays if a meetup still uses the group.
 */
export const releaseTelegramGroup = async (
  db: Db,
  opts: { event: Event; chatId: number },
  now: Date = new Date(),
): Promise<void> => {
  const invites = await deleteTelegramInvites(db, opts.event.id);
  await cancelNotificationsByTemplate(db, {
    eventId: opts.event.id,
    templateKeys: TELEGRAM_GROUP_POST_KEYS,
  });
  const values = await telegramValuesFor(db, opts.event);
  await enqueueTelegram(db, {
    event: opts.event,
    values,
    templateKey: 'telegram_disconnected',
    sendAt: now,
    content: {
      telegramChatId: opts.chatId,
      telegramInviteLinks: invites.map((invite) => invite.inviteLink),
    },
  });
  await armNotificationSchedule(opts.event.id, now);
};

/**
 * Take a member out of a meetup's group as their RSVP is withdrawn.
 *
 * Their invite is deleted at once, so the link admits nobody from this moment. The row that follows
 * removes the Telegram account that used it, if one did, from the chat the group is in now, and
 * revokes the link itself. A member who never asked for an invite, and the host, who holds none,
 * leave nothing to do.
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
  if (group?.status !== 'active' || group.chatId === null) return;
  const values = await telegramValuesFor(db, opts.event);
  await enqueueTelegram(db, {
    event: opts.event,
    values,
    templateKey: 'telegram_member_removed',
    sendAt: now,
    userId: opts.userId,
    content: {
      telegramChatId: group.chatId,
      telegramInviteLink: invite.inviteLink,
      ...(invite.telegramUserId === null
        ? {}
        : { telegramUserId: invite.telegramUserId }),
    },
  });
  await armNotificationSchedule(opts.event.id, now);
};
