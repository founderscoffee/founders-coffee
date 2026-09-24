import { beforeEach, describe, expect, it } from 'vitest';

import { transitionEventStatus } from './events.js';
import type { Db } from './db.js';
import { seedEvent, setupDb } from './rsvps.fixtures.js';
import {
  closeTelegramGroup,
  closeTelegramGroupsForChat,
  completeTelegramConnect,
  findTelegramConnect,
  getTelegramGroup,
  hasOtherActiveTelegramGroup,
  moveTelegramChat,
  openTelegramConnect,
  setTelegramPinnedMessage,
} from './telegram-groups.js';
import { connectGroup, endMeetup, HOUR_MS } from './telegram.fixtures.js';

let chatCounter = 0;

describe('libs/db — telegram groups (real D1 via Miniflare)', () => {
  let db: Db;
  let now: Date;
  let CHAT: number;
  let OTHER_CHAT: number;

  beforeEach(async () => {
    db = await setupDb();
    now = new Date();
    chatCounter += 2;
    CHAT = -1002000000000 - chatCounter;
    OTHER_CHAT = CHAT - 1;
  });

  const open = (eventId: string, tokenHash: string, expiresAt?: Date) =>
    openTelegramConnect(db, {
      eventId,
      tokenHash,
      expiresAt: expiresAt ?? new Date(now.getTime() + HOUR_MS),
      now,
    });

  const complete = (eventId: string, tokenHash: string, chatId?: number) =>
    completeTelegramConnect(db, {
      eventId,
      tokenHash,
      chatId: chatId ?? CHAT,
      chatTitle: 'Coffee group',
      now,
    });

  it('opens a pending connection and lets a later tap replace its token', async () => {
    const eventId = await seedEvent(db);

    expect(await open(eventId, 'first')).toBe(true);
    expect(await open(eventId, 'second')).toBe(true);

    expect(await getTelegramGroup(db, eventId)).toMatchObject({
      status: 'pending',
      connectTokenHash: 'second',
      chatId: null,
    });
    expect(await findTelegramConnect(db, { tokenHash: 'first', now })).toBe(
      undefined,
    );
    expect(
      (await findTelegramConnect(db, { tokenHash: 'second', now }))?.event.id,
    ).toBe(eventId);
  });

  it('connects a token once, to the chat it was sent in', async () => {
    const eventId = await seedEvent(db);
    await open(eventId, 'token');

    expect(await complete(eventId, 'token')).toBe(true);
    expect(await complete(eventId, 'token', OTHER_CHAT)).toBe(false);

    expect(await getTelegramGroup(db, eventId)).toMatchObject({
      status: 'active',
      chatId: CHAT,
      chatTitle: 'Coffee group',
      connectTokenHash: null,
      connectTokenExpiresAt: null,
    });
    expect(await findTelegramConnect(db, { tokenHash: 'token', now })).toBe(
      undefined,
    );
  });

  it('refuses a second Connect while the meetup already has a live group', async () => {
    const eventId = await seedEvent(db);
    await connectGroup(db, eventId, CHAT, now);

    expect(await open(eventId, 'again')).toBe(false);
    expect(await getTelegramGroup(db, eventId)).toMatchObject({
      status: 'active',
      chatId: CHAT,
      connectTokenHash: null,
    });
  });

  it('refuses an expired token', async () => {
    const eventId = await seedEvent(db);
    await open(eventId, 'stale', new Date(now.getTime() - 1000));

    expect(await findTelegramConnect(db, { tokenHash: 'stale', now })).toBe(
      undefined,
    );
    expect(await complete(eventId, 'stale')).toBe(false);
  });

  it('refuses to connect a meetup that was cancelled or has ended since the link was made', async () => {
    const cancelled = await seedEvent(db);
    await open(cancelled, 'cancelled');
    await transitionEventStatus(db, cancelled, 'published', 'cancelled');

    const ended = await seedEvent(db);
    await open(ended, 'ended');
    await endMeetup(db, ended);

    expect(await complete(cancelled, 'cancelled')).toBe(false);
    expect(await complete(ended, 'ended')).toBe(false);
    expect((await getTelegramGroup(db, ended))?.status).toBe('pending');
  });

  it('starts every connection without the previous pin', async () => {
    const eventId = await seedEvent(db);
    await connectGroup(db, eventId, CHAT, now);
    await setTelegramPinnedMessage(db, { eventId, messageId: 41, now });
    await closeTelegramGroup(db, { eventId, now });

    await open(eventId, 'reconnect');
    await complete(eventId, 'reconnect', OTHER_CHAT);

    expect(await getTelegramGroup(db, eventId)).toMatchObject({
      status: 'active',
      chatId: OTHER_CHAT,
      pinnedMessageId: null,
      closedAt: null,
    });
  });

  it('closes a group once, and withdraws an unused Connect link with it', async () => {
    const live = await seedEvent(db);
    await connectGroup(db, live, CHAT, now);
    const pending = await seedEvent(db);
    await open(pending, 'unused');

    expect(await closeTelegramGroup(db, { eventId: live, now })).toBe(true);
    expect(await closeTelegramGroup(db, { eventId: live, now })).toBe(false);
    expect(await closeTelegramGroup(db, { eventId: pending, now })).toBe(true);

    expect((await getTelegramGroup(db, live))?.status).toBe('closed');
    expect(await getTelegramGroup(db, pending)).toMatchObject({
      status: 'closed',
      connectTokenHash: null,
    });
    expect(await findTelegramConnect(db, { tokenHash: 'unused', now })).toBe(
      undefined,
    );
  });

  it('closes every live meetup on a chat the bot was removed from, and nothing else', async () => {
    const first = await seedEvent(db);
    const second = await seedEvent(db);
    const elsewhere = await seedEvent(db);
    await connectGroup(db, first, CHAT, now);
    await connectGroup(db, second, CHAT, now);
    await connectGroup(db, elsewhere, OTHER_CHAT, now);

    const closed = await closeTelegramGroupsForChat(db, { chatId: CHAT, now });

    expect(closed.sort()).toEqual([first, second].sort());
    expect((await getTelegramGroup(db, elsewhere))?.status).toBe('active');
  });

  it('follows a group to its new id when Telegram upgrades it', async () => {
    const live = await seedEvent(db);
    const past = await seedEvent(db);
    await connectGroup(db, live, CHAT, now);
    await connectGroup(db, past, CHAT, now);
    await closeTelegramGroup(db, { eventId: past, now });

    const moved = await moveTelegramChat(db, {
      fromChatId: CHAT,
      toChatId: OTHER_CHAT,
      now,
    });

    expect(moved).toBe(2);
    expect((await getTelegramGroup(db, live))?.chatId).toBe(OTHER_CHAT);
    expect((await getTelegramGroup(db, past))?.chatId).toBe(OTHER_CHAT);
  });

  it('knows when another meetup still keeps the bot in a chat', async () => {
    const first = await seedEvent(db);
    const second = await seedEvent(db);
    await connectGroup(db, first, CHAT, now);
    await connectGroup(db, second, CHAT, now);

    expect(
      await hasOtherActiveTelegramGroup(db, {
        chatId: CHAT,
        exceptEventId: first,
      }),
    ).toBe(true);

    await closeTelegramGroup(db, { eventId: second, now });

    expect(
      await hasOtherActiveTelegramGroup(db, {
        chatId: CHAT,
        exceptEventId: first,
      }),
    ).toBe(false);
  });
});
