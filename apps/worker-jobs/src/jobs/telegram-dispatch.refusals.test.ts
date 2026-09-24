import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  closeTelegramGroup,
  getTelegramGroup,
  listTelegramInvites,
  saveTelegramInvite,
  type Db,
} from '@founders-coffee/db';
import { DevTelegramProvider } from '@founders-coffee/notifications';

import {
  HOST_ID,
  liveGroup,
  MEMBER_ID,
  queue,
  rateLimited,
  refusal,
  rowOf,
  run,
  SECOND,
  setupDb,
} from './telegram.fixtures.js';

const RETRY = 61 * SECOND;

describe('the Telegram dispatcher when Telegram says no (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const pinnedGroup = async (telegram: DevTelegramProvider) => {
    const group = await liveGroup(db);
    await queue(db, group.eventId, 'telegram_details', {
      telegramPinnedText: 'v1',
    });
    await run(db, group.eventId, telegram);
    return group;
  };

  it('takes an edit that changes nothing as done, and holds one refused for now', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        editMessage: [
          { kind: 'not_modified', message: 'not modified' },
          refusal('unavailable'),
        ],
      },
    });
    const { eventId } = await pinnedGroup(telegram);
    const same = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'v1',
    });
    await run(db, eventId, telegram);
    const held = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'v2',
    });
    await run(db, eventId, telegram);

    expect((await rowOf(db, same))?.status).toBe('sent');
    expect((await rowOf(db, held))?.status).toBe('pending');
    expect(telegram.callsTo('sendMessage')).toHaveLength(1);
  });

  it('edits the stored message when a refused pin is retried, rather than posting it again', async () => {
    const telegram = new DevTelegramProvider({
      failures: { pinMessage: [rateLimited] },
    });
    const { eventId } = await liveGroup(db);
    const row = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'v1',
    });
    const start = Date.now();

    await run(db, eventId, telegram, new Date(start));
    expect((await rowOf(db, row))?.status).toBe('pending');
    expect((await getTelegramGroup(db, eventId))?.pinnedMessageId).toBe(100);
    await run(db, eventId, telegram, new Date(start + RETRY));

    expect((await rowOf(db, row))?.status).toBe('sent');
    expect(telegram.callsTo('sendMessage')).toHaveLength(1);
    expect(telegram.callsTo('editMessage')).toHaveLength(1);
  });

  it('lets a pin refused for good go, since the details are posted', async () => {
    const telegram = new DevTelegramProvider({
      failures: { pinMessage: [refusal('rejected')] },
    });
    const { eventId } = await liveGroup(db);
    const row = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'v1',
    });

    await run(db, eventId, telegram);

    expect((await rowOf(db, row))?.status).toBe('sent');
  });

  it('stops at the first refusal, so a retried change is posted once', async () => {
    const telegram = new DevTelegramProvider({
      failures: { sendMessage: [refusal('unavailable')] },
    });
    const { eventId } = await liveGroup(db);
    const row = await queue(db, eventId, 'telegram_relocated', {
      telegramText: 'The meetup has moved.',
      telegramPinnedText: 'Details, moved',
    });
    const start = Date.now();

    await run(db, eventId, telegram, new Date(start));
    expect(telegram.callsTo('sendMessage')).toHaveLength(1);
    await run(db, eventId, telegram, new Date(start + RETRY));

    expect((await rowOf(db, row))?.status).toBe('sent');
    expect(
      telegram
        .callsTo('sendMessage')
        .filter((call) => call.args.text === 'The meetup has moved.'),
    ).toHaveLength(1);
  });

  it('posts no retry into a group that closed meanwhile, and no first goodbye into a closed one', async () => {
    const telegram = new DevTelegramProvider({
      failures: { sendMessage: [rateLimited] },
    });
    const { eventId } = await liveGroup(db);
    const reminder = await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    const start = Date.now();
    await run(db, eventId, telegram, new Date(start));
    await closeTelegramGroup(db, { eventId, now: new Date(start) });
    const goodbye = await queue(db, eventId, 'telegram_wrap_up', {
      telegramText: 'Thanks for coming.',
    });

    await run(db, eventId, telegram, new Date(start + RETRY));

    for (const row of [reminder, goodbye])
      expect((await rowOf(db, row))?.lastError).toBe(
        'telegram_group_closed: the meetup has no live group',
      );
    expect(telegram.calls.map((call) => call.method)).toEqual(['sendMessage']);
  });

  it('revokes only what is left on a retry, and goes on when the bot cannot leave', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        revokeInviteLink: [null, refusal('unavailable')],
        leaveChat: [refusal('rejected')],
      },
    });
    const { eventId } = await liveGroup(db);
    for (const userId of [MEMBER_ID, HOST_ID])
      await saveTelegramInvite(db, {
        id: id('tgi'),
        eventId,
        userId,
        inviteLink: `https://t.me/+left${userId}`,
        now: new Date(),
      });
    const row = await queue(db, eventId, 'telegram_wrap_up', {
      telegramText: 'Thanks for coming.',
    });
    const start = Date.now();

    await run(db, eventId, telegram, new Date(start));
    expect(await listTelegramInvites(db, eventId)).toHaveLength(1);
    await run(db, eventId, telegram, new Date(start + RETRY));

    expect(telegram.callsTo('revokeInviteLink')).toHaveLength(3);
    expect(telegram.callsTo('leaveChat')).toHaveLength(1);
    expect((await rowOf(db, row))?.status).toBe('sent');
  });

  it('stops revoking in a chat that is gone, and forgets every invite', async () => {
    const telegram = new DevTelegramProvider({
      failures: { revokeInviteLink: [refusal('chat_gone')] },
    });
    const { eventId } = await liveGroup(db);
    for (const userId of [MEMBER_ID, HOST_ID])
      await saveTelegramInvite(db, {
        id: id('tgi'),
        eventId,
        userId,
        inviteLink: `https://t.me/+gone${userId}`,
        now: new Date(),
      });
    await queue(db, eventId, 'telegram_wrap_up', {
      telegramText: 'Thanks for coming.',
    });

    await run(db, eventId, telegram);

    expect(telegram.callsTo('revokeInviteLink')).toHaveLength(1);
    expect(await listTelegramInvites(db, eventId)).toEqual([]);
  });

  it('counts a chat the bot is already out of as left, links and all', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        revokeInviteLink: [refusal('chat_gone')],
        leaveChat: [refusal('chat_gone')],
      },
    });
    const { eventId, chatId } = await liveGroup(db);
    await closeTelegramGroup(db, { eventId, now: new Date() });
    const row = await queue(db, eventId, 'telegram_disconnected', {
      telegramChatId: chatId,
      telegramInviteLinks: ['https://t.me/+first', 'https://t.me/+second'],
    });

    await run(db, eventId, telegram);

    expect(telegram.calls.map((call) => call.method)).toEqual([
      'revokeInviteLink',
      'leaveChat',
    ]);
    expect((await rowOf(db, row))?.status).toBe('sent');
  });

  it('holds a removal or a departure whose link Telegram could not revoke yet', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        revokeInviteLink: [refusal('unavailable'), refusal('unavailable')],
      },
    });
    const member = await liveGroup(db);
    const removal = await queue(db, member.eventId, 'telegram_member_removed', {
      telegramChatId: member.chatId,
      telegramUserId: 7100000002,
      telegramInviteLink: 'https://t.me/+later',
    });
    const group = await liveGroup(db);
    await closeTelegramGroup(db, { eventId: group.eventId, now: new Date() });
    const departure = await queue(db, group.eventId, 'telegram_disconnected', {
      telegramChatId: group.chatId,
      telegramInviteLinks: ['https://t.me/+laterstill'],
    });

    await run(db, member.eventId, telegram);
    await run(db, group.eventId, telegram);

    for (const row of [removal, departure])
      expect((await rowOf(db, row))?.status).toBe('pending');
    expect((await rowOf(db, removal))?.payload).toHaveProperty(
      'telegramUserId',
      7100000002,
    );
    expect(telegram.calls.map((call) => call.method)).toEqual([
      'revokeInviteLink',
      'revokeInviteLink',
    ]);
  });

  it('forgets the account of a removal Telegram kept refusing, once it gives up', async () => {
    const telegram = new DevTelegramProvider({
      failures: {
        removeMember: Array.from({ length: 3 }, () => refusal('unavailable')),
      },
    });
    const { eventId, chatId } = await liveGroup(db);
    const row = await queue(db, eventId, 'telegram_member_removed', {
      telegramChatId: chatId,
      telegramUserId: 7100000003,
    });
    const start = Date.now();

    await run(db, eventId, telegram, new Date(start));
    await run(db, eventId, telegram, new Date(start + RETRY));
    expect((await rowOf(db, row))?.payload).toHaveProperty('telegramUserId');
    await run(db, eventId, telegram, new Date(start + 400 * SECOND));

    expect((await rowOf(db, row))?.status).toBe('failed');
    expect((await rowOf(db, row))?.payload).not.toHaveProperty(
      'telegramUserId',
    );
  });
});
