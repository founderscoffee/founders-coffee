import { beforeEach, describe, expect, it } from 'vitest';

import {
  closeTelegramGroup,
  getTelegramGroup,
  type Db,
} from '@founders-coffee/db';
import { DevTelegramProvider } from '@founders-coffee/notifications';

import { sweepNotifications } from './notification-sweep.js';
import { providers } from './notification-sweep.fixtures.js';
import {
  liveGroup,
  queue,
  rateLimited,
  refusal,
  rowOf,
  run,
  SECOND,
  setupDb,
} from './telegram.fixtures.js';

describe("posts in a meetup's Telegram group (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('pins the details once, and edits them in place after that', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const telegram = new DevTelegramProvider();
    const first = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'Details v1',
    });

    await run(db, eventId, telegram);
    const second = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'Details v2',
    });
    await run(db, eventId, telegram);

    expect(telegram.callsTo('sendMessage').map((call) => call.args)).toEqual([
      { chatId, text: 'Details v1', withPreview: true },
    ]);
    expect(telegram.callsTo('editMessage').map((call) => call.args)).toEqual([
      { chatId, messageId: 100, text: 'Details v2' },
    ]);
    expect(telegram.callsTo('pinMessage')).toHaveLength(2);
    expect((await getTelegramGroup(db, eventId))?.pinnedMessageId).toBe(100);
    expect((await rowOf(db, first))?.status).toBe('sent');
    expect((await rowOf(db, second))?.status).toBe('sent');
  });

  it('posts a change beside the rewritten pin, and a reminder on its own', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const telegram = new DevTelegramProvider();
    await queue(db, eventId, 'telegram_rescheduled', {
      telegramText: 'The host has moved the meetup.',
      telegramPinnedText: 'Details, moved',
    });
    await run(db, eventId, telegram);
    await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    await run(db, eventId, telegram);

    expect(
      telegram.calls.map(({ method, args }) => [method, args.text ?? null]),
    ).toEqual([
      ['sendMessage', 'Details, moved'],
      ['pinMessage', null],
      ['sendMessage', 'The host has moved the meetup.'],
      ['sendMessage', 'Tomorrow: coffee.'],
    ]);
    expect(telegram.callsTo('sendMessage')[2]?.args).toEqual({
      chatId,
      text: 'Tomorrow: coffee.',
    });
  });

  it('replaces a pinned message Telegram will no longer edit', async () => {
    const { eventId } = await liveGroup(db);
    const telegram = new DevTelegramProvider({
      failures: { editMessage: [refusal('message_missing')] },
    });
    await queue(db, eventId, 'telegram_details', { telegramPinnedText: 'v1' });
    await run(db, eventId, telegram);
    const row = await queue(db, eventId, 'telegram_details', {
      telegramPinnedText: 'v2',
    });

    await run(db, eventId, telegram);

    expect((await rowOf(db, row))?.status).toBe('sent');
    expect(telegram.callsTo('pinMessage').map((call) => call.args)).toEqual([
      expect.objectContaining({ messageId: 100 }),
      expect.objectContaining({ messageId: 101 }),
    ]);
    expect((await getTelegramGroup(db, eventId))?.pinnedMessageId).toBe(101);
  });

  it('follows a group Telegram upgraded, and posts there', async () => {
    const { eventId, chatId } = await liveGroup(db);
    const upgraded = chatId - 500;
    const telegram = new DevTelegramProvider({
      failures: {
        sendMessage: [
          { kind: 'migrated', chatId: upgraded, message: 'upgraded' },
        ],
      },
    });
    const row = await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });

    await run(db, eventId, telegram);

    expect(
      telegram.callsTo('sendMessage').map((call) => call.args.chatId),
    ).toEqual([chatId, upgraded]);
    expect((await getTelegramGroup(db, eventId))?.chatId).toBe(upgraded);
    expect((await rowOf(db, row))?.status).toBe('sent');
  });

  it('closes a meetup whose chat is gone, and withdraws what it had queued', async () => {
    const { eventId } = await liveGroup(db);
    const telegram = new DevTelegramProvider({
      failures: { sendMessage: [refusal('chat_gone')] },
    });
    const reminder = await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    const later = await queue(
      db,
      eventId,
      'telegram_wrap_up',
      { telegramText: 'Thanks for coming.' },
      new Date(Date.now() + 3600 * SECOND),
    );

    await run(db, eventId, telegram);

    expect(await rowOf(db, reminder)).toMatchObject({
      status: 'failed',
      lastError: 'telegram_chat_gone: dev chat_gone',
    });
    expect((await rowOf(db, later))?.status).toBe('cancelled');
    expect((await getTelegramGroup(db, eventId))?.status).toBe('closed');
  });

  it('retries a flood limit, and posts once when it clears', async () => {
    const { eventId } = await liveGroup(db);
    const telegram = new DevTelegramProvider({
      failures: { sendMessage: [rateLimited] },
    });
    const row = await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    const now = Date.now();

    await run(db, eventId, telegram, new Date(now));
    expect(await rowOf(db, row)).toMatchObject({
      status: 'pending',
      attempts: 1,
    });
    await run(db, eventId, telegram, new Date(now + 61 * SECOND));

    expect((await rowOf(db, row))?.status).toBe('sent');
    expect(telegram.callsTo('sendMessage')).toHaveLength(2);
  });

  it('posts nothing to a group that is no longer live, or with no bot configured', async () => {
    const { eventId } = await liveGroup(db);
    const telegram = new DevTelegramProvider();
    await closeTelegramGroup(db, { eventId, now: new Date() });
    const closed = await queue(db, eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    await run(db, eventId, telegram);
    const other = await liveGroup(db);
    const unconfigured = await queue(db, other.eventId, 'telegram_reminder', {
      telegramText: 'Tomorrow: coffee.',
    });
    await sweepNotifications(db, providers(), new Date(), {
      eventId: other.eventId,
    });

    expect(await rowOf(db, closed)).toMatchObject({
      status: 'failed',
      lastError: 'telegram_group_closed: the meetup has no live group',
    });
    expect((await rowOf(db, unconfigured))?.lastError).toBe(
      "no_provider: channel 'telegram' is not configured",
    );
    expect(telegram.calls).toEqual([]);
  });
});
