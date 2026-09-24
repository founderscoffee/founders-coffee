import type { Result } from '@founders-coffee/core';
import { z } from 'zod';

export type TelegramFailure =
  | {
      readonly kind: 'migrated';
      readonly chatId: number;
      readonly message: string;
    }
  | {
      readonly kind: 'rate_limited';
      readonly retryAfterSeconds: number;
      readonly message: string;
    }
  | { readonly kind: 'chat_gone'; readonly message: string }
  | { readonly kind: 'not_modified'; readonly message: string }
  | { readonly kind: 'message_missing'; readonly message: string }
  | { readonly kind: 'rejected'; readonly message: string }
  | { readonly kind: 'unavailable'; readonly message: string };

export type TelegramResult<T> = Result<T, TelegramFailure>;

export const TELEGRAM_MEMBER_STATUSES = [
  'creator',
  'administrator',
  'member',
  'restricted',
  'left',
  'kicked',
] as const;

export interface TelegramChatMember {
  readonly status: (typeof TELEGRAM_MEMBER_STATUSES)[number];
  readonly canInviteUsers: boolean;
  readonly canRestrictMembers: boolean;
  readonly canPinMessages: boolean;
}

export interface TelegramBotProvider {
  readonly name: string;
  readonly botId: number;
  sendMessage(args: {
    chatId: number;
    text: string;
    withPreview?: boolean;
  }): Promise<TelegramResult<{ messageId: number }>>;
  pinMessage(args: {
    chatId: number;
    messageId: number;
  }): Promise<TelegramResult<void>>;
  editMessage(args: {
    chatId: number;
    messageId: number;
    text: string;
  }): Promise<TelegramResult<void>>;
  createInviteLink(args: {
    chatId: number;
  }): Promise<TelegramResult<{ inviteLink: string }>>;
  revokeInviteLink(args: {
    chatId: number;
    inviteLink: string;
  }): Promise<TelegramResult<void>>;
  approveJoinRequest(args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<void>>;
  declineJoinRequest(args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<void>>;
  removeMember(args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<void>>;
  leaveChat(args: { chatId: number }): Promise<TelegramResult<void>>;
  getChatMember(args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<TelegramChatMember>>;
}

const apiFailureSchema = z.object({
  ok: z.literal(false),
  error_code: z.number().int().optional(),
  description: z.string().optional(),
  parameters: z
    .object({
      migrate_to_chat_id: z.number().int().optional(),
      retry_after: z.number().int().optional(),
    })
    .optional(),
});

/**
 * The bot's own user id, which Telegram writes into the start of every bot token.
 *
 * Reading it here spares a `getMe` round trip on every request that needs to recognise the bot in
 * an update, such as telling its own membership change from someone else's.
 */
export const botIdFromToken = (token: string): number => {
  const id = Number(token.split(':')[0]);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
};

/**
 * Sort a Bot API refusal into the few outcomes a caller acts on differently.
 *
 * Telegram answers with a code and an English description and nothing more structured, except for
 * two parameters: the new id of a group that became a supergroup, and how long to wait after a
 * flood limit. Everything the product does next hangs off this sorting — a group that has gone
 * closes, a flood limit and a server error are retried, an unchanged edit counts as done, a pinned
 * message someone deleted is posted again — so the descriptions it matches are the ones the Bot API
 * documents for those cases. Anything else is a refusal that retrying will not change.
 */
export const telegramFailureFrom = (
  status: number,
  body: unknown,
): TelegramFailure => {
  const parsed = apiFailureSchema.safeParse(body);
  const description = parsed.success
    ? (parsed.data.description ?? `HTTP ${status}`)
    : `HTTP ${status}`;
  const code = parsed.success ? (parsed.data.error_code ?? status) : status;
  const parameters = parsed.success ? parsed.data.parameters : undefined;
  const lower = description.toLowerCase();

  if (parameters?.migrate_to_chat_id !== undefined)
    return {
      kind: 'migrated',
      chatId: parameters.migrate_to_chat_id,
      message: description,
    };
  if (code === 429)
    return {
      kind: 'rate_limited',
      retryAfterSeconds: parameters?.retry_after ?? 1,
      message: description,
    };
  if (code === 403 || lower.includes('chat not found'))
    return { kind: 'chat_gone', message: description };
  if (lower.includes('message is not modified'))
    return { kind: 'not_modified', message: description };
  if (lower.includes('message to edit not found'))
    return { kind: 'message_missing', message: description };
  if (!parsed.success || code >= 500)
    return { kind: 'unavailable', message: description };
  return { kind: 'rejected', message: description };
};
