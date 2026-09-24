import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getEvent,
  getRsvpForUser,
  getTelegramGroup,
  getTelegramInvite,
  type Db,
  type EventTelegramGroupRow,
} from '@founders-coffee/db';

import type { TelegramSetup } from './config.js';
import { isAdmitting, isConnectable } from './window.js';

export type TelegramGroupView =
  | { readonly role: 'none' }
  | {
      readonly role: 'host';
      readonly status: 'none' | 'pending' | 'active';
      readonly chatTitle: string | null;
      readonly canConnect: boolean;
    }
  | {
      readonly role: 'attendee';
      readonly inviteLink: string | null;
      readonly hasJoined: boolean;
    };

const NOTHING: TelegramGroupView = { role: 'none' };

const hostStatusOf = (
  group: EventTelegramGroupRow | undefined,
  now: Date,
): 'none' | 'pending' | 'active' => {
  if (group?.status === 'active') return 'active';
  const expiresAt = group?.connectTokenExpiresAt;
  if (group?.status === 'pending' && expiresAt && expiresAt > now)
    return 'pending';
  return 'none';
};

/**
 * What the meetup's Telegram group looks like to the member reading its page.
 *
 * The host sees whether a group is connected, or waiting for the bot to be added through a link that
 * has not expired, and whether one can still be connected, which it cannot once the meetup is
 * cancelled or over. A group that closed is shown as none, since all the host can do is connect one
 * again. A member who is going sees the group while it is active and still admitting, with the link
 * they were given, if they asked for one, and whether they have used it. Everyone else sees nothing,
 * and so does everyone when the deployment runs no bot.
 */
export const readTelegramGroupView = async (
  db: Db,
  setup: TelegramSetup | null,
  opts: { eventId: string; viewerId: string; now: Date },
): Promise<Result<TelegramGroupView>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (!setup) return ok(NOTHING);
  const group = await getTelegramGroup(db, event.id);
  if (event.hostId === opts.viewerId)
    return ok({
      role: 'host',
      status: hostStatusOf(group, opts.now),
      chatTitle: group?.status === 'active' ? group.chatTitle : null,
      canConnect: isConnectable(event, opts.now),
    });
  if (!isAdmitting(event, opts.now) || group?.status !== 'active')
    return ok(NOTHING);
  const rsvp = await getRsvpForUser(db, {
    eventId: event.id,
    userId: opts.viewerId,
  });
  if (rsvp?.status !== 'going') return ok(NOTHING);
  const invite = await getTelegramInvite(db, {
    eventId: event.id,
    userId: opts.viewerId,
  });
  return ok({
    role: 'attendee',
    inviteLink: invite?.inviteLink ?? null,
    hasJoined: invite?.telegramUserId != null,
  });
};
