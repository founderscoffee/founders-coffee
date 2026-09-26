import {
  admitTelegramMember,
  closeTelegramGroupsForChat,
  moveTelegramChat,
  type Db,
} from '@founders-coffee/db';
import type { TelegramBotProvider } from '@founders-coffee/notifications';
import { logger, reportError } from '@founders-coffee/observability';

import { getDb } from '../db.js';
import { RATE_BUDGETS } from '../rate-budgets.js';
import { consumeRateBudget } from '../rate-consume.js';
import { readBounded } from '../read-bounded.js';
import { telegramSetup, type TelegramSetup } from './config.js';
import { connectFromStart, startToken } from './connect.js';
import { secretsMatch } from './token.js';
import {
  parseTelegramUpdate,
  type TelegramJoinRequest,
  type TelegramUpdate,
} from './updates.js';

export const TELEGRAM_WEBHOOK_PATH = '/api/telegram/webhook';

const UPDATE_MAX_BYTES = 64 * 1024;

const GROUP_TYPES = ['group', 'supergroup'];

const GONE_STATUSES = ['left', 'kicked'];

/**
 * Let a member into the group through the invite they were given, or turn the request away.
 *
 * Only links this bot made are its to decide. A link the host made stays theirs, and the request
 * waits for them in Telegram. So does one past the chat's budget, rather than being declined.
 */
const decideJoinRequest = async (
  db: Db,
  telegram: TelegramBotProvider,
  request: TelegramJoinRequest,
  now: Date,
): Promise<void> => {
  const link = request.invite_link;
  if (!link || link.creator.id !== telegram.botId) return;
  const chatId = request.chat.id;
  const budget = RATE_BUDGETS.telegram.joinRequest;
  if (
    !(await consumeRateBudget(
      `tg:${chatId}`,
      budget.action,
      budget.limit,
      budget.windowMs,
    ))
  ) {
    logger.warn('telegram.join_request_deferred', { chatId });
    return;
  }
  const admitted = await admitTelegramMember(db, {
    inviteLink: link.invite_link,
    chatId,
    telegramUserId: request.from.id,
    now,
  });
  const answered = admitted
    ? await telegram.approveJoinRequest({ chatId, userId: request.from.id })
    : await telegram.declineJoinRequest({ chatId, userId: request.from.id });
  logger.info('telegram.join_request', {
    eventId: admitted?.eventId,
    admitted: Boolean(admitted),
    answered: answered.ok,
  });
};

/**
 * Act on one update: the four things the bot listens for, and nothing else.
 *
 * A group upgraded to a supergroup is followed to its new id. A `/start` carrying a connect token
 * connects the group. The bot being removed closes every meetup using the chat, the same as a call
 * to it failing would. A join request through one of the bot's links is decided. Any other message
 * is the group's own conversation, and is left alone.
 */
export const answerTelegramUpdate = async (
  db: Db,
  setup: TelegramSetup,
  update: TelegramUpdate,
  now: Date,
): Promise<void> => {
  const message = update.message;
  if (message?.migrate_to_chat_id !== undefined) {
    await moveTelegramChat(db, {
      fromChatId: message.chat.id,
      toChatId: message.migrate_to_chat_id,
      now,
    });
    return;
  }
  if (message && GROUP_TYPES.includes(message.chat.type)) {
    const token = startToken(message.text, setup.botUsername);
    if (token) await connectFromStart(db, setup, message, token, now);
    return;
  }
  const change = update.my_chat_member;
  if (
    change?.new_chat_member.user.id === setup.provider.botId &&
    GONE_STATUSES.includes(change.new_chat_member.status)
  ) {
    await closeTelegramGroupsForChat(db, { chatId: change.chat.id, now });
    return;
  }
  if (update.chat_join_request)
    await decideJoinRequest(db, setup.provider, update.chat_join_request, now);
};

/**
 * Answer a call to the webhook.
 *
 * With no bot configured there is nothing here. A call without the secret Telegram was given when
 * the webhook was set is refused, and nothing in it is read. After that the answer is always 200,
 * whatever became of the update: Telegram retries anything else, and an update that failed once
 * would only fail again, or worse, half succeed twice. A failure is reported instead.
 */
export const serveTelegramWebhook = async (
  request: Request,
  setup: TelegramSetup | null,
  now: Date = new Date(),
): Promise<Response> => {
  if (!setup) return new Response(null, { status: 404 });
  const secret = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!(await secretsMatch(secret, setup.webhookSecret)))
    return new Response(null, { status: 401 });
  try {
    const bytes = await readBounded(request, UPDATE_MAX_BYTES);
    const update = bytes ? parseTelegramUpdate(bytes) : null;
    if (update) await answerTelegramUpdate(getDb(), setup, update, now);
    else logger.warn('telegram.update_unreadable');
  } catch (error) {
    reportError(error, { operation: 'telegram.webhook' });
  }
  return new Response(null, { status: 200 });
};

/** The Telegram webhook, or `null` when the request is not a call to it. */
export const handleTelegramWebhook = (
  request: Request,
  url: URL,
): Promise<Response> | null =>
  url.pathname === TELEGRAM_WEBHOOK_PATH && request.method === 'POST'
    ? serveTelegramWebhook(request, telegramSetup())
    : null;
