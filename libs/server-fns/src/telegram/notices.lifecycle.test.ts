import { beforeEach, describe, expect, it } from 'vitest';

import {
  admitTelegramMember,
  closeTelegramGroup,
  getTelegramInvite,
  saveTelegramInvite,
  type Db,
  type Event,
} from '@founders-coffee/db';

import {
  announceTelegramCancellation,
  announceTelegramUpdate,
  releaseTelegramGroup,
  scheduleTelegramGroup,
  withdrawTelegramMember,
} from './notices.js';
import {
  attend,
  connectMeetup,
  MEMBER_IDS,
  pendingKeys,
  seedMeetup,
  setupDb,
  telegramRows,
} from './telegram.fixtures.js';

const HOUR_MS = 60 * 60 * 1000;

const payloadOf = (row: { payload: Record<string, unknown> } | undefined) =>
  (row?.payload ?? {}) as {
    telegramText?: string;
    telegramPinnedText?: string;
    telegramUserId?: number;
    telegramInviteLink?: string;
    locale?: string;
  };

describe("Telegram group notices through a meetup's life (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const connected = async (overrides: Partial<Event> = {}) => {
    const event = await seedMeetup(db, overrides);
    await connectMeetup(db, event);
    return event;
  };

  it('moves the reminder and the goodbye with a new time, and tells the group', async () => {
    const before = await connected();
    await scheduleTelegramGroup(db, before);
    const after: Event = {
      ...before,
      startsAt: new Date('2099-01-17T18:00:00Z'),
      endsAt: new Date('2099-01-17T20:00:00Z'),
    };

    await announceTelegramUpdate(db, {
      before,
      after,
      notice: 'event_rescheduled',
    });

    const pending = (await telegramRows(db, before.id)).filter(
      (row) => row.status === 'pending',
    );
    expect(
      pending.map((row) => [row.templateKey, row.sendAt.getTime()]),
    ).toEqual(
      expect.arrayContaining([
        ['telegram_reminder', after.startsAt.getTime() - 24 * HOUR_MS],
        ['telegram_wrap_up', (after.endsAt?.getTime() ?? 0) + 24 * HOUR_MS],
      ]),
    );
    expect(pending.map((row) => row.templateKey).sort()).toEqual([
      'telegram_details',
      'telegram_reminder',
      'telegram_rescheduled',
      'telegram_wrap_up',
    ]);
    const notice = pending.find(
      (row) => row.templateKey === 'telegram_rescheduled',
    );
    expect(payloadOf(notice).telegramText).toContain('The host has moved');
    expect(payloadOf(notice).telegramPinnedText).toContain(before.title);
  });

  it('only rewrites the pin for a quiet edit, and leaves the group alone for an unrelated one', async () => {
    const before = await connected();
    await scheduleTelegramGroup(db, before);
    const renamed: Event = { ...before, title: 'Renamed coffee' };

    await announceTelegramUpdate(db, {
      before,
      after: renamed,
      notice: null,
    });
    const afterRename = await telegramRows(db, before.id);
    await announceTelegramUpdate(db, {
      before: renamed,
      after: { ...renamed, description: 'Longer description' },
      notice: null,
    });

    const refresh = afterRename.filter(
      (row) =>
        row.templateKey === 'telegram_details' && row.status === 'pending',
    );
    expect(refresh).toHaveLength(2);
    expect(payloadOf(refresh[1]).telegramText).toBeUndefined();
    expect(payloadOf(refresh[1]).telegramPinnedText).toContain(
      'Renamed coffee',
    );
    expect(await telegramRows(db, before.id)).toHaveLength(afterRename.length);
  });

  it('does nothing for a meetup whose group is not live', async () => {
    const event = await seedMeetup(db);

    await announceTelegramUpdate(db, {
      before: event,
      after: { ...event, title: 'Renamed' },
      notice: null,
    });
    await announceTelegramCancellation(db, { event });

    expect(await telegramRows(db, event.id)).toEqual([]);
  });

  it('posts the cancellation with its reason and rewrites the pin', async () => {
    const event = await connected();

    await announceTelegramCancellation(db, { event, reason: 'Café closed' });

    const [row] = await telegramRows(db, event.id);
    expect(row?.templateKey).toBe('telegram_cancelled');
    expect(payloadOf(row).telegramText).toContain('The host has cancelled');
    expect(payloadOf(row).telegramText).toContain('From the host: Café closed');
    expect(payloadOf(row).telegramPinnedText).toMatch(/^Cancelled: /);
  });

  it('withdraws everything queued for the group when the host disconnects it', async () => {
    const event = await connected();
    await scheduleTelegramGroup(db, event);

    await releaseTelegramGroup(db, event);

    expect(await pendingKeys(db, event.id)).toEqual(['telegram_disconnected']);
  });

  it('removes a member who cancels, through the account that used their link', async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);
    await saveTelegramInvite(db, {
      id: 'tgi_withdraw',
      eventId: event.id,
      userId: MEMBER_IDS[0],
      inviteLink: 'https://t.me/+withdraw',
      now: new Date(),
    });
    await admitTelegramMember(db, {
      inviteLink: 'https://t.me/+withdraw',
      chatId,
      telegramUserId: 7100000001,
    });

    await withdrawTelegramMember(db, { event, userId: MEMBER_IDS[0] });

    expect(
      await getTelegramInvite(db, { eventId: event.id, userId: MEMBER_IDS[0] }),
    ).toBeUndefined();
    const [row] = await telegramRows(db, event.id);
    expect(row).toMatchObject({
      templateKey: 'telegram_member_removed',
      userId: MEMBER_IDS[0],
    });
    expect(payloadOf(row)).toMatchObject({
      telegramUserId: 7100000001,
      telegramInviteLink: 'https://t.me/+withdraw',
    });
  });

  it('revokes an unused link, and does nothing for a member who never asked for one', async () => {
    const event = await connected();
    await saveTelegramInvite(db, {
      id: 'tgi_unused',
      eventId: event.id,
      userId: MEMBER_IDS[1],
      inviteLink: 'https://t.me/+unused',
      now: new Date(),
    });

    await withdrawTelegramMember(db, { event, userId: MEMBER_IDS[1] });
    await withdrawTelegramMember(db, { event, userId: MEMBER_IDS[2] });

    const rows = await telegramRows(db, event.id);
    expect(rows).toHaveLength(1);
    expect(payloadOf(rows[0]).telegramUserId).toBeUndefined();
    expect(payloadOf(rows[0]).telegramInviteLink).toBe('https://t.me/+unused');
  });

  it('deletes the invite but queues nothing once the group is closed', async () => {
    const event = await connected();
    await saveTelegramInvite(db, {
      id: 'tgi_closed',
      eventId: event.id,
      userId: MEMBER_IDS[2],
      inviteLink: 'https://t.me/+closed',
      now: new Date(),
    });
    await closeTelegramGroup(db, { eventId: event.id, now: new Date() });

    await withdrawTelegramMember(db, { event, userId: MEMBER_IDS[2] });

    expect(
      await getTelegramInvite(db, { eventId: event.id, userId: MEMBER_IDS[2] }),
    ).toBeUndefined();
    expect(await telegramRows(db, event.id)).toEqual([]);
  });
});
