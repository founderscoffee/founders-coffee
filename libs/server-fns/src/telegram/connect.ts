import {
  completeTelegramConnect,
  findTelegramConnect,
  type Db,
} from '@founders-coffee/db';
import {
  ntf_telegram_connect_needs_rights,
  ntf_telegram_connect_not_admin,
} from '@founders-coffee/i18n';
import type { TelegramBotProvider } from '@founders-coffee/notifications';
import { logger } from '@founders-coffee/observability';

import { resolveNotificationContext } from '../notifications/context.js';
import { RATE_BUDGETS } from '../rate-budgets.js';
import { consumeRateBudget } from '../rate-consume.js';
import type { TelegramSetup } from './config.js';
import { scheduleTelegramGroup } from './notices.js';
import { hashConnectToken } from './token.js';
import type { TelegramMessage } from './updates.js';

const START = /^\/start(?:@([A-Za-z0-9_]+))?\s+([A-Za-z0-9_-]{16,64})$/;

/**
 * The connect token in a `/start` addressed to this bot, or `null` for any other message.
 *
 * Adding the bot through a `startgroup` link makes Telegram post `/start@bot <token>` in the group.
 * As an admin the bot sees every message there, commands meant for other bots included, so one that
 * names another bot is not ours.
 */
export const startToken = (
  text: string | undefined,
  botUsername: string,
): string | null => {
  const match = text === undefined ? null : START.exec(text.trim());
  if (!match) return null;
  const [, mention, token] = match;
  if (mention && mention.toLowerCase() !== botUsername.toLowerCase())
    return null;
  return token ?? null;
};

/**
 * Whether the message came from someone who runs the group. An admin posting anonymously posts as
 * the group itself, and counts. A lookup Telegram refuses answers `null`, which decides nothing.
 */
const sentByAdmin = async (
  telegram: TelegramBotProvider,
  message: TelegramMessage,
): Promise<boolean | null> => {
  if (message.sender_chat?.id === message.chat.id) return true;
  if (!message.from) return false;
  const sender = await telegram.getChatMember({
    chatId: message.chat.id,
    userId: message.from.id,
  });
  if (!sender.ok) return null;
  return (
    sender.data.status === 'creator' || sender.data.status === 'administrator'
  );
};

/** Whether the bot holds the three rights the group needs from it, or `null` when Telegram will not say. */
const botCanRunGroup = async (
  telegram: TelegramBotProvider,
  chatId: number,
): Promise<boolean | null> => {
  const bot = await telegram.getChatMember({ chatId, userId: telegram.botId });
  if (!bot.ok) return null;
  return (
    bot.data.status === 'administrator' &&
    bot.data.canInviteUsers &&
    bot.data.canRestrictMembers &&
    bot.data.canPinMessages
  );
};

/**
 * Connect the group a `/start` was posted in to the meetup whose token it carries.
 *
 * A token that is unknown, spent or expired gets no answer, so the group learns nothing from one it
 * guessed. A real one is answered in the meetup's language when the sender is not an admin of the
 * group, or when the bot lacks a right it needs: approving joins, removing members who cancel, and
 * pinning the details. The host fixes that in Telegram and opens the link again. Everything else is
 * decided by `completeTelegramConnect`, which checks the token and the meetup again in the statement
 * that connects them, and a connected group is given its details at once. A chat gets ten attempts
 * in ten minutes, since each one costs lookups and may cost a reply.
 */
export const connectFromStart = async (
  db: Db,
  setup: TelegramSetup,
  message: TelegramMessage,
  token: string,
  now: Date,
): Promise<void> => {
  const chatId = message.chat.id;
  const budget = RATE_BUDGETS.telegram.connectAttempt;
  if (
    !(await consumeRateBudget(
      `tg:${chatId}`,
      budget.action,
      budget.limit,
      budget.windowMs,
    ))
  )
    return;
  const tokenHash = await hashConnectToken(token);
  const found = await findTelegramConnect(db, { tokenHash, now });
  if (!found) return;
  const { event } = found;
  const telegram = setup.provider;
  const [isAdmin, canRun] = await Promise.all([
    sentByAdmin(telegram, message),
    botCanRunGroup(telegram, chatId),
  ]);
  if (isAdmin === null || canRun === null) {
    logger.warn('telegram.connect_undecided', { eventId: event.id });
    return;
  }
  const { locale } = await resolveNotificationContext(db, {
    preferred: event.language,
    marketCode: event.marketCode,
  });
  const refusal = !isAdmin
    ? ntf_telegram_connect_not_admin({ title: event.title }, { locale })
    : !canRun
      ? ntf_telegram_connect_needs_rights({ title: event.title }, { locale })
      : null;
  if (refusal) {
    await telegram.sendMessage({ chatId, text: refusal });
    return;
  }
  const connected = await completeTelegramConnect(db, {
    eventId: event.id,
    tokenHash,
    chatId,
    chatTitle: message.chat.title ?? null,
    now,
  });
  if (!connected) return;
  logger.info('telegram.connected', { eventId: event.id, chatId });
  await scheduleTelegramGroup(db, event, now);
};
