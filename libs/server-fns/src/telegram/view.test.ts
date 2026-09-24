import { beforeEach, describe, expect, it } from 'vitest';

import {
  admitTelegramMember,
  closeTelegramGroup,
  transitionEventStatus,
  type Db,
} from '@founders-coffee/db';

import type { TelegramSetup } from './config.js';
import { requestTelegramInviteResolver } from './invite.js';
import {
  attend,
  connectMeetup,
  devSetup,
  HOST_ID,
  MEMBER_IDS,
  openConnect,
  seedMeetup,
  setupDb,
} from './telegram.fixtures.js';
import { readTelegramGroupView } from './view.js';

const ACCOUNT = 7300000001;
const HALF_HOUR_MS = 30 * 60 * 1000;

describe("the meetup's Telegram group as its reader sees it (real D1 via Miniflare)", () => {
  let db: Db;
  let setup: TelegramSetup;

  beforeEach(async () => {
    db = await setupDb();
    setup = devSetup();
  });

  const viewOf = async (
    eventId: string,
    viewerId: string,
    now = new Date(),
    runs: TelegramSetup | null = setup,
  ) => {
    const result = await readTelegramGroupView(db, runs, {
      eventId,
      viewerId,
      now,
    });
    return result.ok ? result.data : result.error.code;
  };

  it('shows the host whether a group is connected, waiting for the bot, or neither', async () => {
    const event = await seedMeetup(db);
    const none = await viewOf(event.id, HOST_ID);
    await openConnect(db, event);
    const pending = await viewOf(event.id, HOST_ID);
    await connectMeetup(db, event);
    const active = await viewOf(event.id, HOST_ID);
    await closeTelegramGroup(db, { eventId: event.id, now: new Date() });
    const closed = await viewOf(event.id, HOST_ID);

    expect([none, pending, active, closed]).toEqual([
      { role: 'host', status: 'none', chatTitle: null, canConnect: true },
      { role: 'host', status: 'pending', chatTitle: null, canConnect: true },
      {
        role: 'host',
        status: 'active',
        chatTitle: 'Coffee group',
        canConnect: true,
      },
      { role: 'host', status: 'none', chatTitle: null, canConnect: true },
    ]);
  });

  it('forgets a Connect link once it expires', async () => {
    const event = await seedMeetup(db);
    await openConnect(db, event, new Date(Date.now() - HALF_HOUR_MS - 1000));

    expect(await viewOf(event.id, HOST_ID)).toMatchObject({ status: 'none' });
  });

  it('tells the host a cancelled or finished meetup can no longer take a group', async () => {
    const cancelled = await seedMeetup(db);
    await transitionEventStatus(db, cancelled.id, 'published', 'cancelled');
    const finished = await seedMeetup(db);

    expect(await viewOf(cancelled.id, HOST_ID)).toMatchObject({
      canConnect: false,
    });
    expect(
      await viewOf(finished.id, HOST_ID, new Date('2099-01-15T20:00:00Z')),
    ).toMatchObject({ canConnect: false });
  });

  it('shows a going member the group once it runs, then their link, then that they joined', async () => {
    const event = await seedMeetup(db);
    await attend(db, event.id, MEMBER_IDS[0]);
    const before = await viewOf(event.id, MEMBER_IDS[0]);
    const chatId = await connectMeetup(db, event);
    const running = await viewOf(event.id, MEMBER_IDS[0]);
    const invite = await requestTelegramInviteResolver(db, setup, {
      eventId: event.id,
      userId: MEMBER_IDS[0],
      now: new Date(),
    });
    const inviteLink = invite.ok ? invite.data.inviteLink : '';
    const invited = await viewOf(event.id, MEMBER_IDS[0]);
    await admitTelegramMember(db, {
      inviteLink,
      chatId,
      telegramUserId: ACCOUNT,
      now: new Date(),
    });
    const joined = await viewOf(event.id, MEMBER_IDS[0]);

    expect([before, running, invited, joined]).toEqual([
      { role: 'none' },
      { role: 'attendee', inviteLink: null, hasJoined: false },
      { role: 'attendee', inviteLink, hasJoined: false },
      { role: 'attendee', inviteLink, hasJoined: true },
    ]);
  });

  it('shows nothing to anyone not going, or once the group stops letting members in', async () => {
    const event = await seedMeetup(db);
    await connectMeetup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);

    expect(await viewOf(event.id, MEMBER_IDS[1])).toEqual({ role: 'none' });
    expect(
      await viewOf(event.id, MEMBER_IDS[0], new Date('2099-01-16T20:00:00Z')),
    ).toEqual({ role: 'none' });
  });

  it('shows nothing to anyone where the deployment runs no bot', async () => {
    const event = await seedMeetup(db);
    await connectMeetup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);

    for (const viewerId of [HOST_ID, MEMBER_IDS[0]])
      expect(await viewOf(event.id, viewerId, new Date(), null)).toEqual({
        role: 'none',
      });
    expect(await viewOf('evt_missing', HOST_ID)).toBe('event_not_found');
  });
});
