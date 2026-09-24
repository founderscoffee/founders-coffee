import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  findTelegramConnect,
  getTelegramGroup,
  getTelegramInvite,
  saveTelegramInvite,
  transitionEventStatus,
  type Db,
} from '@founders-coffee/db';

import {
  connectTelegramGroupResolver,
  disconnectTelegramGroupResolver,
} from './host.js';
import { scheduleTelegramGroup } from './notices.js';
import {
  attend,
  BOT_USERNAME,
  connectMeetup,
  devSetup,
  HOST_ID,
  MEMBER_IDS,
  openConnect,
  payloadOf,
  pendingKeys,
  seedMeetup,
  setupDb,
  telegramRows,
} from './telegram.fixtures.js';
import { hashConnectToken } from './token.js';

const LINK = new RegExp(
  `^https://t\\.me/${BOT_USERNAME}\\?startgroup=([A-Za-z0-9_-]{32})&admin=invite_users\\+restrict_members\\+pin_messages$`,
);

describe("a host managing their meetup's Telegram group (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const connect = (eventId: string, actorId = HOST_ID, now = new Date()) =>
    connectTelegramGroupResolver(db, devSetup(), { eventId, actorId, now });

  const disconnect = (eventId: string, actorId = HOST_ID) =>
    disconnectTelegramGroupResolver(db, {
      eventId,
      actorId,
      now: new Date(),
    });

  const tokenOf = (link: string): string => LINK.exec(link)?.[1] ?? '';

  it('hands the host a link that adds the bot with its rights, for thirty minutes', async () => {
    const event = await seedMeetup(db);
    const now = new Date();

    const result = await connect(event.id, HOST_ID, now);

    expect(result.ok && result.data.connectLink).toMatch(LINK);
    expect(result.ok && result.data.expiresAt).toEqual(
      new Date(now.getTime() + 30 * 60 * 1000),
    );
    const token = result.ok ? tokenOf(result.data.connectLink) : '';
    const found = await findTelegramConnect(db, {
      tokenHash: await hashConnectToken(token),
      now,
    });
    expect(found?.event.id).toBe(event.id);
  });

  it('lets only the newest link connect anything', async () => {
    const event = await seedMeetup(db);

    const first = await connect(event.id);
    const second = await connect(event.id);

    const now = new Date();
    for (const [result, isLive] of [
      [first, false],
      [second, true],
    ] as const) {
      const token = result.ok ? tokenOf(result.data.connectLink) : '';
      const found = await findTelegramConnect(db, {
        tokenHash: await hashConnectToken(token),
        now,
      });
      expect(found !== undefined).toBe(isLive);
    }
  });

  it('refuses anyone but the host, and a meetup that does not exist', async () => {
    const event = await seedMeetup(db);

    const stranger = await connect(event.id, MEMBER_IDS[0]);
    const missing = await connect('evt_missing');

    expect(!stranger.ok && stranger.error.code).toBe('event_not_host');
    expect(!missing.ok && missing.error.code).toBe('event_not_found');
    expect(await getTelegramGroup(db, event.id)).toBeUndefined();
  });

  it('refuses a cancelled meetup, a finished one, and one whose group is connected', async () => {
    const cancelled = await seedMeetup(db);
    await transitionEventStatus(db, cancelled.id, 'published', 'cancelled');
    const finished = await seedMeetup(db);
    const connected = await seedMeetup(db);
    await connectMeetup(db, connected);

    const codes = [
      await connect(cancelled.id),
      await connect(finished.id, HOST_ID, new Date('2099-01-15T20:00:00Z')),
      await connect(connected.id),
    ].map((result) => !result.ok && result.error.code);

    expect(codes).toEqual([
      'event_is_cancelled',
      'event_already_ended',
      'telegram_group_connected',
    ]);
    expect((await getTelegramGroup(db, connected.id))?.status).toBe('active');
  });

  it('offers nothing where the deployment runs no bot', async () => {
    const event = await seedMeetup(db);

    const result = await connectTelegramGroupResolver(db, null, {
      eventId: event.id,
      actorId: HOST_ID,
      now: new Date(),
    });

    expect(!result.ok && result.error.code).toBe('telegram_unavailable');
    expect(await getTelegramGroup(db, event.id)).toBeUndefined();
  });

  it('lets the bot go from a running group: no more joins, no more posts, links revoked', async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await scheduleTelegramGroup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);
    await saveTelegramInvite(db, {
      id: id('tgi'),
      eventId: event.id,
      userId: MEMBER_IDS[0],
      inviteLink: 'https://t.me/+hostdisconnects',
      now: new Date(),
    });

    const result = await disconnect(event.id);

    expect(result).toEqual({ ok: true, data: { disconnected: true } });
    expect((await getTelegramGroup(db, event.id))?.status).toBe('closed');
    expect(
      await getTelegramInvite(db, { eventId: event.id, userId: MEMBER_IDS[0] }),
    ).toBeUndefined();
    expect(await pendingKeys(db, event.id)).toEqual(['telegram_disconnected']);
    const departure = (await telegramRows(db, event.id)).find(
      (row) => row.templateKey === 'telegram_disconnected',
    );
    expect(payloadOf(departure)).toMatchObject({
      telegramChatId: chatId,
      telegramInviteLinks: ['https://t.me/+hostdisconnects'],
    });
  });

  it('withdraws a link the host has not used, with nothing for the bot to do', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);

    const result = await disconnect(event.id);

    expect(result).toEqual({ ok: true, data: { disconnected: true } });
    expect(
      await findTelegramConnect(db, {
        tokenHash: await hashConnectToken(token),
        now: new Date(),
      }),
    ).toBeUndefined();
    expect(await telegramRows(db, event.id)).toEqual([]);
  });

  it('answers a second disconnect as the no-op it is, and refuses anyone but the host', async () => {
    const event = await seedMeetup(db);
    await connectMeetup(db, event);
    await disconnect(event.id);

    const again = await disconnect(event.id);
    const stranger = await disconnect(event.id, MEMBER_IDS[1]);

    expect(again).toEqual({ ok: true, data: { disconnected: false } });
    expect(!stranger.ok && stranger.error.code).toBe('event_not_host');
    expect(await pendingKeys(db, event.id)).toEqual(['telegram_disconnected']);
  });
});
