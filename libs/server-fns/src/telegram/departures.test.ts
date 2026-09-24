import { beforeEach, describe, expect, it } from 'vitest';

import {
  admitTelegramMember,
  closeTelegramGroup,
  getTelegramInvite,
  saveTelegramInvite,
  type Db,
  type Event,
} from '@founders-coffee/db';

import { releaseTelegramGroup, withdrawTelegramMember } from './departures.js';
import { scheduleTelegramGroup } from './notices.js';
import {
  attend,
  connectMeetup,
  MEMBER_IDS,
  payloadOf,
  pendingKeys,
  seedMeetup,
  setupDb,
  telegramRows,
} from './telegram.fixtures.js';

describe('members and hosts leaving a Telegram group (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const connected = async (overrides: Partial<Event> = {}) => {
    const event = await seedMeetup(db, overrides);
    await connectMeetup(db, event);
    return event;
  };

  it('withdraws the posts queued for a disconnected group, and its invites, and leaves its chat', async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await scheduleTelegramGroup(db, event);
    for (const [index, userId] of [MEMBER_IDS[0], MEMBER_IDS[1]].entries())
      await saveTelegramInvite(db, {
        id: `tgi_release${index}`,
        eventId: event.id,
        userId,
        inviteLink: `https://t.me/+release${index}`,
        now: new Date(),
      });
    await withdrawTelegramMember(db, { event, userId: MEMBER_IDS[1] });

    await releaseTelegramGroup(db, { event, chatId });

    expect((await pendingKeys(db, event.id)).sort()).toEqual([
      'telegram_disconnected',
      'telegram_member_removed',
    ]);
    const leave = (await telegramRows(db, event.id)).find(
      (row) => row.templateKey === 'telegram_disconnected',
    );
    expect(payloadOf(leave)).toMatchObject({
      telegramChatId: chatId,
      telegramInviteLinks: ['https://t.me/+release0'],
    });
    expect(
      await getTelegramInvite(db, { eventId: event.id, userId: MEMBER_IDS[0] }),
    ).toBeUndefined();
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
      telegramChatId: chatId,
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
