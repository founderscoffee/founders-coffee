import { err, id, ok } from '@founders-coffee/core';

import type {
  TelegramBotProvider,
  TelegramChatMember,
  TelegramFailure,
  TelegramResult,
} from './telegram-provider.js';

export const DEV_TELEGRAM_BOT_ID = 1000000001;

export type TelegramMethod = Exclude<
  keyof TelegramBotProvider,
  'name' | 'botId'
>;

export interface TelegramCall {
  readonly method: TelegramMethod;
  readonly args: Readonly<Record<string, unknown>>;
}

const ADMIN_WITH_EVERY_RIGHT: TelegramChatMember = {
  status: 'administrator',
  canInviteUsers: true,
  canRestrictMembers: true,
  canPinMessages: true,
};

export class DevTelegramProvider implements TelegramBotProvider {
  readonly name = 'dev-telegram';
  readonly botId = DEV_TELEGRAM_BOT_ID;
  readonly calls: TelegramCall[] = [];
  private nextMessageId = 100;
  private readonly members: ReadonlyMap<number, TelegramChatMember>;
  private readonly failures: Map<TelegramMethod, TelegramFailure[]>;

  /**
   * The Telegram provider for local development and tests: no network, a record of every call.
   *
   * It answers the way the Bot API does when everything is in order. Messages get increasing ids,
   * invite links are unique, and every member lookup finds an administrator with the three rights the
   * bot asks for, unless `members` names someone else. `failures` queues refusals per method, each
   * spent by one call, so a test can make the third `sendMessage` hit a flood limit and see what
   * happens next.
   */
  constructor(
    options: {
      members?: ReadonlyMap<number, TelegramChatMember>;
      failures?: Partial<Record<TelegramMethod, TelegramFailure[]>>;
    } = {},
  ) {
    this.members = options.members ?? new Map();
    this.failures = new Map(
      Object.entries(options.failures ?? {}).map(([method, queue]) => [
        method as TelegramMethod,
        [...(queue ?? [])],
      ]),
    );
  }

  /** Every call made to one method, in order, for assertions. */
  callsTo = (method: TelegramMethod): TelegramCall[] =>
    this.calls.filter((call) => call.method === method);

  private record = <T>(
    method: TelegramMethod,
    args: Record<string, unknown>,
    answer: () => T,
  ): Promise<TelegramResult<T>> => {
    this.calls.push({ method, args });
    const failure = this.failures.get(method)?.shift();
    return Promise.resolve(failure ? err(failure) : ok(answer()));
  };

  sendMessage = (args: {
    chatId: number;
    text: string;
    withPreview?: boolean;
  }) =>
    this.record('sendMessage', args, () => ({
      messageId: this.nextMessageId++,
    }));

  pinMessage = (args: { chatId: number; messageId: number }) =>
    this.record('pinMessage', args, () => undefined);

  editMessage = (args: { chatId: number; messageId: number; text: string }) =>
    this.record('editMessage', args, () => undefined);

  createInviteLink = (args: { chatId: number }) =>
    this.record('createInviteLink', args, () => ({
      inviteLink: `https://t.me/+${id('dev')}`,
    }));

  revokeInviteLink = (args: { chatId: number; inviteLink: string }) =>
    this.record('revokeInviteLink', args, () => undefined);

  approveJoinRequest = (args: { chatId: number; userId: number }) =>
    this.record('approveJoinRequest', args, () => undefined);

  declineJoinRequest = (args: { chatId: number; userId: number }) =>
    this.record('declineJoinRequest', args, () => undefined);

  removeMember = (args: { chatId: number; userId: number }) =>
    this.record('removeMember', args, () => undefined);

  leaveChat = (args: { chatId: number }) =>
    this.record('leaveChat', args, () => undefined);

  getChatMember = (args: { chatId: number; userId: number }) =>
    this.record(
      'getChatMember',
      args,
      () => this.members.get(args.userId) ?? ADMIN_WITH_EVERY_RIGHT,
    );
}
