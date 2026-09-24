import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  admitTelegramMember,
  closeTelegramGroup,
  createRsvp,
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
  refusal,
  rowOf,
  run,
  SECOND,
  setupDb,
} from './telegram.fixtures.js';

const ACCOUNT = 7100000001;

describe("a meetup's Telegram group closing, and members leaving it (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const invite = async (eventId: string, userId: string, link: string) => {
    await saveTelegramInvite(db, {
      id: id('tgi'),
      eventId,
      userId,
      inviteLink: link,
      now: new Date(),
    });
    return link;
  };

  it('closes the group a day after, says goodbye, and leaves', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const telegram = new DevTelegramProvider();
    await invite(eventId, MEMBER_ID, 'https://t.me/+wrapmember');
    await invite(eventId, HOST_ID, 'https://t.me/+wraphost');
    const row = await queue(db, eventId, 'telegram_wrap_up', {
      telegramText: 'Thanks for coming.',
    });

    await run(db, eventId, telegram);

    expect(telegram.calls.map((call) => call.method)).toEqual([
      'revokeInviteLink',
      'revokeInviteLink',
      'sendMessage',
      'leaveChat',
    ]);
    expect(telegram.callsTo('leaveChat')[0]?.args).toEqual({ chatId });
    expect(await listTelegramInvites(db, eventId)).toEqual([]);
    expect((await getTelegramGroup(db, eventId))?.status).toBe('closed');
    expect((await rowOf(db, row))?.status).toBe('sent');
  });

  it('rewrites the pin of a cancelled meetup, and stays where another meetup still runs', async () => {
    const { eventId, chatId } = await liveGroup(db);
    await liveGroup(db, chatId);
    const telegram = new DevTelegramProvider();
    await queue(db, eventId, 'telegram_details', { telegramPinnedText: 'On' });
    await run(db, eventId, telegram);
    await queue(db, eventId, 'telegram_cancelled', {
      telegramText: 'The host has cancelled.',
      telegramPinnedText: 'Cancelled: coffee',
    });

    await run(db, eventId, telegram);

    expect(telegram.callsTo('editMessage')[0]?.args).toEqual({
      chatId,
      messageId: 100,
      text: 'Cancelled: coffee',
    });
    expect(telegram.callsTo('sendMessage').at(-1)?.args.text).toBe(
      'The host has cancelled.',
    );
    expect(telegram.callsTo('leaveChat')).toEqual([]);
  });

  it('retries a revoke Telegram refused for now, and lets the invites go on the last try', async () => {
    const { eventId } = await liveGroup(db);
    const telegram = new DevTelegramProvider({
      failures: {
        revokeInviteLink: [
          refusal('unavailable'),
          refusal('unavailable'),
          refusal('unavailable'),
        ],
      },
    });
    await invite(eventId, MEMBER_ID, 'https://t.me/+stubborn');
    const row = await queue(db, eventId, 'telegram_wrap_up', {
      telegramText: 'Thanks for coming.',
    });
    const start = Date.now();

    await run(db, eventId, telegram, new Date(start));
    expect((await getTelegramGroup(db, eventId))?.status).toBe('closed');
    await run(db, eventId, telegram, new Date(start + 61 * SECOND));
    expect(await listTelegramInvites(db, eventId)).toHaveLength(1);
    await run(db, eventId, telegram, new Date(start + 400 * SECOND));

    expect(await rowOf(db, row)).toMatchObject({ status: 'sent', attempts: 2 });
    expect(await listTelegramInvites(db, eventId)).toEqual([]);
    expect(telegram.callsTo('sendMessage')).toHaveLength(1);
  });

  it("revokes a disconnected group's links and leaves its chat, unless it is back in use", async () => {
    const released = await liveGroup(db);
    const reconnected = await liveGroup(db);
    await closeTelegramGroup(db, {
      eventId: released.eventId,
      now: new Date(),
    });
    const telegram = new DevTelegramProvider();
    const gone = await queue(db, released.eventId, 'telegram_disconnected', {
      telegramChatId: released.chatId,
      telegramInviteLinks: ['https://t.me/+released'],
    });
    await queue(db, reconnected.eventId, 'telegram_disconnected', {
      telegramChatId: reconnected.chatId,
    });

    await run(db, released.eventId, telegram);
    await run(db, reconnected.eventId, telegram);

    expect(telegram.calls).toEqual([
      {
        method: 'revokeInviteLink',
        args: { chatId: released.chatId, inviteLink: 'https://t.me/+released' },
      },
      { method: 'leaveChat', args: { chatId: released.chatId } },
    ]);
    expect((await rowOf(db, gone))?.status).toBe('sent');
  });

  it('takes a member who cancelled out, and revokes their link', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const telegram = new DevTelegramProvider();
    const row = await queue(db, eventId, 'telegram_member_removed', {
      telegramChatId: chatId,
      telegramUserId: ACCOUNT,
      telegramInviteLink: 'https://t.me/+cancelled',
    });

    await run(db, eventId, telegram);

    expect(telegram.calls).toEqual([
      {
        method: 'revokeInviteLink',
        args: { chatId, inviteLink: 'https://t.me/+cancelled' },
      },
      { method: 'removeMember', args: { chatId, userId: ACCOUNT } },
    ]);
    const settled = await rowOf(db, row);
    expect(settled?.status).toBe('sent');
    expect(settled?.payload).not.toHaveProperty('telegramUserId');
  });

  it('keeps a member another meetup in the group still admits', async () => {
    const cancelled = await liveGroup(db);
    const still = await liveGroup(db, cancelled.chatId);
    await createRsvp(db, {
      id: id('rsvp'),
      eventId: still.eventId,
      userId: MEMBER_ID,
    });
    await admitTelegramMember(db, {
      inviteLink: await invite(still.eventId, MEMBER_ID, 'https://t.me/+kept'),
      chatId: still.chatId,
      telegramUserId: ACCOUNT,
    });
    const telegram = new DevTelegramProvider();
    await queue(db, cancelled.eventId, 'telegram_member_removed', {
      telegramChatId: cancelled.chatId,
      telegramUserId: ACCOUNT,
    });

    await run(db, cancelled.eventId, telegram);

    expect(telegram.callsTo('removeMember')).toEqual([]);
  });

  it('records a removal Telegram refuses, and a row that names no chat', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const telegram = new DevTelegramProvider({
      failures: { removeMember: [refusal('rejected')] },
    });
    const refused = await queue(db, eventId, 'telegram_member_removed', {
      telegramChatId: chatId,
      telegramUserId: ACCOUNT,
    });
    const nameless = await queue(db, eventId, 'telegram_member_removed', {
      telegramUserId: ACCOUNT,
    });

    await run(db, eventId, telegram);

    expect(await rowOf(db, refused)).toMatchObject({
      status: 'failed',
      lastError: 'telegram_rejected: dev rejected',
    });
    expect((await rowOf(db, refused))?.payload).not.toHaveProperty(
      'telegramUserId',
    );
    expect(await rowOf(db, nameless)).toMatchObject({
      status: 'failed',
      lastError: 'telegram_payload_incomplete: no chat named',
    });
  });
});
