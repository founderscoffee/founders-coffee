import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BotApiTelegramProvider } from './telegram-bot-api.js';

const TOKEN = '123456789:AAF-secret_part';
const CHAT = -1001234567890;

const answer = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

const calls = () => vi.mocked(globalThis.fetch).mock.calls;

const request = (index: number) => {
  const [url, init] = calls()[index] ?? [];
  return {
    method: String(url).split('/').pop(),
    url: String(url),
    body: JSON.parse(String((init as RequestInit).body)) as Record<
      string,
      unknown
    >,
  };
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(answer({ ok: true, result: true })),
  );
});

describe('BotApiTelegramProvider', () => {
  const provider = () => new BotApiTelegramProvider(TOKEN);

  it('knows its own bot id from the token', () => {
    expect(provider().botId).toBe(123456789);
  });

  it('posts a message as JSON to the method named in the URL', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer({ ok: true, result: { message_id: 42 } }),
    );

    const result = await provider().sendMessage({ chatId: CHAT, text: 'Hi' });

    expect(result).toEqual({ ok: true, data: { messageId: 42 } });
    expect(request(0).url).toBe(
      `https://api.telegram.org/bot${TOKEN}/sendMessage`,
    );
    expect(request(0).body).toEqual({
      chat_id: CHAT,
      text: 'Hi',
      link_preview_options: { is_disabled: true },
    });
  });

  it('shows a link preview only when asked to', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer({ ok: true, result: { message_id: 1 } }),
    );

    await provider().sendMessage({
      chatId: CHAT,
      text: 'Hi',
      withPreview: true,
    });

    expect(request(0).body.link_preview_options).toEqual({
      is_disabled: false,
    });
  });

  it('pins without notifying the group', async () => {
    await provider().pinMessage({ chatId: CHAT, messageId: 42 });

    expect(request(0)).toMatchObject({
      method: 'pinChatMessage',
      body: { chat_id: CHAT, message_id: 42, disable_notification: true },
    });
  });

  it('asks for invite links that send a join request instead of letting people in', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer({ ok: true, result: { invite_link: 'https://t.me/+abc' } }),
    );

    const result = await provider().createInviteLink({ chatId: CHAT });

    expect(result).toEqual({
      ok: true,
      data: { inviteLink: 'https://t.me/+abc' },
    });
    expect(request(0)).toMatchObject({
      method: 'createChatInviteLink',
      body: { chat_id: CHAT, creates_join_request: true },
    });
  });

  it('removes a member by banning and at once unbanning, so they can come back', async () => {
    await provider().removeMember({ chatId: CHAT, userId: 77 });

    expect(request(0)).toMatchObject({
      method: 'banChatMember',
      body: { chat_id: CHAT, user_id: 77, revoke_messages: false },
    });
    expect(request(1)).toMatchObject({
      method: 'unbanChatMember',
      body: { chat_id: CHAT, user_id: 77, only_if_banned: true },
    });
  });

  it('stops before the unban when the ban was refused', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer(
        {
          ok: false,
          error_code: 400,
          description: "Bad Request: can't remove chat owner",
        },
        400,
      ),
    );

    const result = await provider().removeMember({ chatId: CHAT, userId: 77 });

    expect(result).toMatchObject({ ok: false, error: { kind: 'rejected' } });
    expect(calls()).toHaveLength(1);
  });

  it('reports the rights an administrator holds, and every right for the creator', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(
        answer({
          ok: true,
          result: {
            status: 'administrator',
            can_invite_users: true,
            can_restrict_members: false,
            can_pin_messages: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        answer({ ok: true, result: { status: 'creator' } }),
      );

    const admin = await provider().getChatMember({ chatId: CHAT, userId: 1 });
    const creator = await provider().getChatMember({ chatId: CHAT, userId: 2 });

    expect(admin).toEqual({
      ok: true,
      data: {
        status: 'administrator',
        canInviteUsers: true,
        canRestrictMembers: false,
        canPinMessages: true,
      },
    });
    expect(creator).toMatchObject({
      ok: true,
      data: {
        canInviteUsers: true,
        canRestrictMembers: true,
        canPinMessages: true,
      },
    });
  });

  it('names the method in a refusal and never the token', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer(
        {
          ok: false,
          error_code: 403,
          description: 'Forbidden: bot is not a member',
        },
        403,
      ),
    );

    const result = await provider().leaveChat({ chatId: CHAT });

    expect(result).toEqual({
      ok: false,
      error: {
        kind: 'chat_gone',
        message: 'leaveChat: Forbidden: bot is not a member',
      },
    });
  });

  it('cuts the token out of a network error that quotes the address', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(
      new TypeError(
        `fetch failed for https://api.telegram.org/bot${TOKEN}/leaveChat`,
      ),
    );

    const result = await provider().leaveChat({ chatId: CHAT });

    expect(result).toMatchObject({ ok: false, error: { kind: 'unavailable' } });
    expect(JSON.stringify(result)).not.toContain('secret_part');
  });

  it('treats an answer that is not the expected shape as a refusal to retry', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      answer({ ok: true, result: { unexpected: true } }),
    );

    const result = await provider().sendMessage({ chatId: CHAT, text: 'Hi' });

    expect(result).toMatchObject({ ok: false, error: { kind: 'unavailable' } });
  });
});
