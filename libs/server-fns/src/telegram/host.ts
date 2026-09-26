import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  closeTelegramGroup,
  getEvent,
  openTelegramConnect,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import type { TelegramSetup } from './config.js';
import { releaseTelegramGroup } from './departures.js';
import { createConnectToken, hashConnectToken } from './token.js';
import { isConnectable } from './window.js';

const CONNECT_LINK_TTL_MS = 30 * 60 * 1000;

const BOT_RIGHTS = ['invite_users', 'restrict_members', 'pin_messages'];

/**
 * The link that adds the bot to a group of the host's choosing, as an admin with the rights it needs.
 *
 * Telegram lists the host's groups, asks them to confirm the rights, and then posts `/start` with the
 * token in the group they picked, which is how the webhook learns which meetup the group is for.
 */
export const connectLinkFor = (botUsername: string, token: string): string =>
  `https://t.me/${botUsername}?startgroup=${token}&admin=${BOT_RIGHTS.join('+')}`;

const hostedEvent = async (
  db: Db,
  eventId: string,
  actorId: string,
): Promise<Result<Event>> => {
  const event = await getEvent(db, eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (event.hostId !== actorId)
    return err(
      new AppError(
        'event_not_host',
        "Only the host can manage this meetup's Telegram group",
      ),
    );
  return ok(event);
};

/**
 * Give the host a link that connects a Telegram group to their meetup.
 *
 * Only while there is a meetup to talk about, so not once it is cancelled or over, and only where the
 * deployment runs a bot. Each call makes a fresh token, good for thirty minutes, that replaces any
 * the host was given before, so only the newest link connects anything. A meetup whose group is
 * connected keeps it; the host disconnects it first.
 */
export const connectTelegramGroupResolver = async (
  db: Db,
  setup: TelegramSetup | null,
  opts: { eventId: string; actorId: string; now: Date },
): Promise<Result<{ connectLink: string; expiresAt: Date }>> => {
  const hosted = await hostedEvent(db, opts.eventId, opts.actorId);
  if (!hosted.ok) return hosted;
  const event = hosted.data;
  if (!setup)
    return err(
      new AppError('telegram_unavailable', 'Telegram groups are not available'),
    );
  if (event.status === 'cancelled')
    return err(
      new AppError('event_is_cancelled', 'This meetup has been cancelled'),
    );
  if (!isConnectable(event, opts.now))
    return err(
      new AppError('event_already_ended', 'This meetup has already ended'),
    );

  const token = createConnectToken();
  const expiresAt = new Date(opts.now.getTime() + CONNECT_LINK_TTL_MS);
  const opened = await openTelegramConnect(db, {
    eventId: event.id,
    tokenHash: await hashConnectToken(token),
    expiresAt,
    now: opts.now,
  });
  if (!opened)
    return err(
      new AppError(
        'telegram_group_connected',
        'This meetup already has a Telegram group',
      ),
    );
  logger.info('telegram.connect_opened', {
    eventId: event.id,
    marketCode: event.marketCode,
  });
  return ok({
    connectLink: connectLinkFor(setup.botUsername, token),
    expiresAt,
  });
};

/**
 * Unhook the meetup's Telegram group, or withdraw a Connect link the host has not used yet.
 *
 * The group is the host's, so they can let the bot go at any time, a cancelled or finished meetup
 * included. It closes first, so nobody is admitted from that moment. A group that was running is
 * then released: the invites are taken back and the bot revokes their links and leaves the chat.
 * Answers whether there was anything to disconnect, so a second tap is a quiet no-op.
 */
export const disconnectTelegramGroupResolver = async (
  db: Db,
  opts: { eventId: string; actorId: string; now: Date },
): Promise<Result<{ disconnected: boolean }>> => {
  const hosted = await hostedEvent(db, opts.eventId, opts.actorId);
  if (!hosted.ok) return hosted;
  const event = hosted.data;
  const closed = await closeTelegramGroup(db, {
    eventId: event.id,
    now: opts.now,
  });
  if (!closed) return ok({ disconnected: false });
  if (closed.chatId !== null)
    await releaseTelegramGroup(db, { event, chatId: closed.chatId }, opts.now);
  logger.info('telegram.disconnected', {
    eventId: event.id,
    marketCode: event.marketCode,
    wasConnected: closed.chatId !== null,
  });
  return ok({ disconnected: true });
};
