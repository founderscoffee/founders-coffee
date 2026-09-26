import { describe, expect, it } from 'vitest';

import { DevTelegramProvider } from './telegram-dev-provider.js';
import { botIdFromToken, telegramFailureFrom } from './telegram-provider.js';

const TOKEN = '123456789:AAF-secret_part';
const CHAT = -1001234567890;

describe('botIdFromToken', () => {
  it('reads the bot id Telegram writes at the start of a token', () => {
    expect(botIdFromToken(TOKEN)).toBe(123456789);
    expect(botIdFromToken('not-a-token')).toBe(0);
  });
});

describe('telegramFailureFrom', () => {
  const refusal = (
    error_code: number,
    description: string,
    parameters?: object,
  ) => ({ ok: false, error_code, description, parameters });

  it('carries the new chat id of a group that became a supergroup', () => {
    expect(
      telegramFailureFrom(
        400,
        refusal(
          400,
          'Bad Request: group chat was upgraded to a supergroup chat',
          {
            migrate_to_chat_id: -100999,
          },
        ),
      ),
    ).toMatchObject({ kind: 'migrated', chatId: -100999 });
  });

  it('sorts the refusals a caller acts on differently', () => {
    expect(
      telegramFailureFrom(
        429,
        refusal(429, 'Too Many Requests', { retry_after: 7 }),
      ),
    ).toMatchObject({ kind: 'rate_limited', retryAfterSeconds: 7 });
    expect(
      telegramFailureFrom(
        403,
        refusal(403, 'Forbidden: bot was kicked from the supergroup chat'),
      ).kind,
    ).toBe('chat_gone');
    expect(
      telegramFailureFrom(400, refusal(400, 'Bad Request: chat not found'))
        .kind,
    ).toBe('chat_gone');
    expect(
      telegramFailureFrom(
        400,
        refusal(
          400,
          'Bad Request: message is not modified: specified new message content',
        ),
      ).kind,
    ).toBe('not_modified');
    expect(
      telegramFailureFrom(
        400,
        refusal(400, 'Bad Request: message to edit not found'),
      ).kind,
    ).toBe('message_missing');
    expect(
      telegramFailureFrom(400, refusal(400, 'Bad Request: not enough rights'))
        .kind,
    ).toBe('rejected');
  });

  it('treats a server error or an unreadable answer as worth retrying', () => {
    expect(telegramFailureFrom(502, refusal(502, 'Bad Gateway')).kind).toBe(
      'unavailable',
    );
    expect(telegramFailureFrom(502, null).kind).toBe('unavailable');
  });
});

describe('DevTelegramProvider', () => {
  it('records each call and answers the way the Bot API does', async () => {
    const telegram = new DevTelegramProvider();

    const first = await telegram.sendMessage({ chatId: CHAT, text: 'one' });
    const second = await telegram.sendMessage({ chatId: CHAT, text: 'two' });
    const link = await telegram.createInviteLink({ chatId: CHAT });
    const again = await telegram.createInviteLink({ chatId: CHAT });

    expect(
      first.ok && second.ok && first.data.messageId < second.data.messageId,
    ).toBe(true);
    expect(
      link.ok && again.ok && link.data.inviteLink !== again.data.inviteLink,
    ).toBe(true);
    expect(
      telegram.callsTo('sendMessage').map((call) => call.args.text),
    ).toEqual(['one', 'two']);
  });

  it('spends each queued slot on one call, a refusal or a pass, then answers normally', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        leaveChat: [null, { kind: 'unavailable', message: 'down' }],
      },
    });

    expect((await telegram.leaveChat({ chatId: CHAT })).ok).toBe(true);
    expect((await telegram.leaveChat({ chatId: CHAT })).ok).toBe(false);
    expect((await telegram.leaveChat({ chatId: CHAT })).ok).toBe(true);
  });

  it('finds an administrator with every right unless told otherwise', async () => {
    const telegram = new DevTelegramProvider({
      members: new Map([
        [
          5,
          {
            status: 'member',
            canInviteUsers: false,
            canRestrictMembers: false,
            canPinMessages: false,
          },
        ],
      ]),
    });

    expect(
      await telegram.getChatMember({ chatId: CHAT, userId: 1 }),
    ).toMatchObject({
      ok: true,
      data: { status: 'administrator', canRestrictMembers: true },
    });
    expect(
      await telegram.getChatMember({ chatId: CHAT, userId: 5 }),
    ).toMatchObject({
      ok: true,
      data: { status: 'member' },
    });
  });
});
