import { err, ok } from '@founders-coffee/core';
import { z } from 'zod';

import {
  botIdFromToken,
  telegramFailureFrom,
  TELEGRAM_MEMBER_STATUSES,
  type TelegramBotProvider,
  type TelegramChatMember,
  type TelegramResult,
} from './telegram-provider.js';

const API_ROOT = 'https://api.telegram.org';

const messageSchema = z.object({ message_id: z.number().int() });
const inviteLinkSchema = z.object({ invite_link: z.string().url() });
const chatMemberSchema = z.object({
  status: z.enum(TELEGRAM_MEMBER_STATUSES),
  can_invite_users: z.boolean().optional(),
  can_restrict_members: z.boolean().optional(),
  can_pin_messages: z.boolean().optional(),
});

export class BotApiTelegramProvider implements TelegramBotProvider {
  readonly name = 'telegram-bot-api';
  readonly botId: number;
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
    this.botId = botIdFromToken(token);
  }

  /**
   * Call one Bot API method and parse the part of its answer the caller uses.
   *
   * The token is part of the URL, so a failure's message is built from Telegram's description or the
   * error's name, never from the request, and a network error has the token cut out of it in case
   * the runtime quoted the address it could not reach.
   */
  private call = async <T>(
    method: string,
    params: Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<TelegramResult<T>> => {
    let response: Response;
    try {
      response = await fetch(`${API_ROOT}/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown';
      return err({
        kind: 'unavailable',
        message: `${method}: ${reason.split(this.token).join('[token]')}`,
      });
    }

    const body: unknown = await response.json().catch(() => null);
    const envelope = z
      .object({ ok: z.literal(true), result: schema })
      .safeParse(body);
    if (envelope.success) return ok(envelope.data.result);
    const failure = telegramFailureFrom(response.status, body);
    return err({ ...failure, message: `${method}: ${failure.message}` });
  };

  private done = async (
    method: string,
    params: Record<string, unknown>,
  ): Promise<TelegramResult<void>> => {
    const result = await this.call(method, params, z.unknown());
    return result.ok ? ok(undefined) : result;
  };

  sendMessage = async (args: {
    chatId: number;
    text: string;
    withPreview?: boolean;
  }): Promise<TelegramResult<{ messageId: number }>> => {
    const result = await this.call(
      'sendMessage',
      {
        chat_id: args.chatId,
        text: args.text,
        link_preview_options: { is_disabled: !args.withPreview },
      },
      messageSchema,
    );
    return result.ok ? ok({ messageId: result.data.message_id }) : result;
  };

  pinMessage = (args: { chatId: number; messageId: number }) =>
    this.done('pinChatMessage', {
      chat_id: args.chatId,
      message_id: args.messageId,
      disable_notification: true,
    });

  editMessage = (args: { chatId: number; messageId: number; text: string }) =>
    this.done('editMessageText', {
      chat_id: args.chatId,
      message_id: args.messageId,
      text: args.text,
    });

  createInviteLink = async (args: {
    chatId: number;
  }): Promise<TelegramResult<{ inviteLink: string }>> => {
    const result = await this.call(
      'createChatInviteLink',
      { chat_id: args.chatId, creates_join_request: true },
      inviteLinkSchema,
    );
    return result.ok ? ok({ inviteLink: result.data.invite_link }) : result;
  };

  revokeInviteLink = (args: { chatId: number; inviteLink: string }) =>
    this.done('revokeChatInviteLink', {
      chat_id: args.chatId,
      invite_link: args.inviteLink,
    });

  approveJoinRequest = (args: { chatId: number; userId: number }) =>
    this.done('approveChatJoinRequest', {
      chat_id: args.chatId,
      user_id: args.userId,
    });

  declineJoinRequest = (args: { chatId: number; userId: number }) =>
    this.done('declineChatJoinRequest', {
      chat_id: args.chatId,
      user_id: args.userId,
    });

  /**
   * Take someone out of a group while leaving them free to come back.
   *
   * The Bot API has no plain "remove": a ban removes, and the unban straight after lifts it, so a
   * member who RSVPs again can be let in by a new link. `only_if_banned` keeps the second call from
   * doing anything to someone the first did not ban.
   */
  removeMember = async (args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<void>> => {
    const banned = await this.done('banChatMember', {
      chat_id: args.chatId,
      user_id: args.userId,
      revoke_messages: false,
    });
    if (!banned.ok) return banned;
    return this.done('unbanChatMember', {
      chat_id: args.chatId,
      user_id: args.userId,
      only_if_banned: true,
    });
  };

  leaveChat = (args: { chatId: number }) =>
    this.done('leaveChat', { chat_id: args.chatId });

  getChatMember = async (args: {
    chatId: number;
    userId: number;
  }): Promise<TelegramResult<TelegramChatMember>> => {
    const result = await this.call(
      'getChatMember',
      { chat_id: args.chatId, user_id: args.userId },
      chatMemberSchema,
    );
    if (!result.ok) return result;
    const isCreator = result.data.status === 'creator';
    return ok({
      status: result.data.status,
      canInviteUsers: isCreator || result.data.can_invite_users === true,
      canRestrictMembers:
        isCreator || result.data.can_restrict_members === true,
      canPinMessages: isCreator || result.data.can_pin_messages === true,
    });
  };
}
