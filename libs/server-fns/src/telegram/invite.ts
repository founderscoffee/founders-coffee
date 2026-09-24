import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  getEvent,
  getRsvpForUser,
  getTelegramGroup,
  getTelegramInvite,
  saveTelegramInvite,
  type Db,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import type { TelegramSetup } from './config.js';
import { isAdmitting } from './window.js';

const telegramUnavailable = (): AppError =>
  new AppError(
    'telegram_unavailable',
    'Telegram could not make an invite link just now',
  );

const noGroup = (): AppError =>
  new AppError(
    'telegram_group_unavailable',
    'This meetup has no Telegram group to join',
  );

/**
 * Give a member who is going their own link into the meetup's Telegram group.
 *
 * The link asks to join rather than letting anyone in, and the bot approves the request only while
 * the member it was made for is still going, so a forwarded link admits nobody else. A member keeps
 * the link they were given, and asking again answers the same one. Two requests racing each other
 * can each have a link made; the one not kept is revoked, so no working link is left behind.
 */
export const requestTelegramInviteResolver = async (
  db: Db,
  setup: TelegramSetup | null,
  opts: { eventId: string; userId: string; now: Date },
): Promise<Result<{ inviteLink: string }>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  const rsvp = await getRsvpForUser(db, {
    eventId: event.id,
    userId: opts.userId,
  });
  if (rsvp?.status !== 'going')
    return err(
      new AppError('rsvp_not_found', 'You are not going to this meetup'),
    );
  const group = await getTelegramGroup(db, event.id);
  if (
    !setup ||
    !isAdmitting(event, opts.now) ||
    group?.status !== 'active' ||
    group.chatId === null
  )
    return err(noGroup());

  const held = await getTelegramInvite(db, {
    eventId: event.id,
    userId: opts.userId,
  });
  if (held) return ok({ inviteLink: held.inviteLink });

  const chatId = group.chatId;
  const created = await setup.provider.createInviteLink({ chatId });
  if (!created.ok) {
    logger.warn('telegram.invite_failed', {
      eventId: event.id,
      reason: created.error.kind,
    });
    return err(telegramUnavailable());
  }
  const saved = await saveTelegramInvite(db, {
    id: id('tgi'),
    eventId: event.id,
    userId: opts.userId,
    inviteLink: created.data.inviteLink,
    now: opts.now,
  });
  if (!saved.written)
    await setup.provider.revokeInviteLink({
      chatId,
      inviteLink: created.data.inviteLink,
    });
  if (!saved.kept) return err(noGroup());
  logger.info('telegram.invite_given', {
    eventId: event.id,
    marketCode: event.marketCode,
    isNew: saved.written,
  });
  return ok({ inviteLink: saved.kept.inviteLink });
};
