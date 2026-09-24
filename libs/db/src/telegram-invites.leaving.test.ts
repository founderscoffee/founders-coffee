import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { enqueueNotification } from './notification-enqueue.js';
import { getNotification } from './notifications.js';
import { cancelRsvp } from './rsvps.js';
import { eventRsvps } from './schema.js';
import { members, seedEvent, setupDb } from './rsvps.fixtures.js';
import { closeTelegramGroup } from './telegram-groups.js';
import {
  admitTelegramMember,
  deleteTelegramInvites,
  forgetTelegramAccount,
  isTelegramMemberOfChat,
  listTelegramInvites,
  takeTelegramInvite,
} from './telegram-invites.js';
import { inviteTo, liveMeetupFor, telegramIds } from './telegram.fixtures.js';

describe('libs/db — telegram invites as members leave (real D1 via Miniflare)', () => {
  let db: Db;
  const now = () => new Date();

  let CHAT: number;
  let OTHER_CHAT: number;
  let ACCOUNT: number;
  let OTHER_ACCOUNT: number;

  beforeEach(async () => {
    db = await setupDb();
    ({ CHAT, OTHER_CHAT, ACCOUNT, OTHER_ACCOUNT } = telegramIds());
  });

  const invite = (eventId: string, userId: string) =>
    inviteTo(db, eventId, userId);

  const liveMeetupWith = (userId: string) => liveMeetupFor(db, CHAT, userId);

  it('hands back and deletes a withdrawn member invite in one step', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[3].id);
    await admitTelegramMember(db, {
      inviteLink,
      chatId: CHAT,
      telegramUserId: ACCOUNT,
      now: new Date(),
    });

    expect(
      await takeTelegramInvite(db, { eventId, userId: members[3].id }),
    ).toMatchObject({ inviteLink, telegramUserId: ACCOUNT });
    expect(
      await takeTelegramInvite(db, { eventId, userId: members[3].id }),
    ).toBeUndefined();
    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: ACCOUNT,
        now: new Date(),
      }),
    ).toBeUndefined();
  });

  it('deletes every invite of a meetup when its group closes, and hands back their links', async () => {
    const eventId = await seedEvent(db);
    const links = [
      await invite(eventId, members[0].id),
      await invite(eventId, members[1].id),
    ];

    const deleted = await deleteTelegramInvites(db, eventId);

    expect(deleted.map((row) => row.inviteLink).sort()).toEqual(links.sort());
    expect(await listTelegramInvites(db, eventId)).toEqual([]);
  });

  it('keeps an account in a chat another meetup still admits it to', async () => {
    const first = await liveMeetupWith(members[4].id);
    const second = await liveMeetupWith(members[4].id);
    for (const { inviteLink } of [first, second])
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: ACCOUNT,
        now: new Date(),
      });
    const memberOf = (chatId: number, telegramUserId = ACCOUNT) =>
      isTelegramMemberOfChat(db, { chatId, telegramUserId });

    await takeTelegramInvite(db, {
      eventId: first.eventId,
      userId: members[4].id,
    });
    expect(await memberOf(CHAT)).toBe(true);
    expect(await memberOf(OTHER_CHAT)).toBe(false);
    expect(await memberOf(CHAT, OTHER_ACCOUNT)).toBe(false);

    await db
      .update(eventRsvps)
      .set({ status: 'waitlist' })
      .where(
        and(
          eq(eventRsvps.eventId, second.eventId),
          eq(eventRsvps.userId, members[4].id),
        ),
      );
    expect(await memberOf(CHAT)).toBe(false);

    await cancelRsvp(db, { eventId: second.eventId, userId: members[4].id });
    expect(await memberOf(CHAT)).toBe(false);
  });

  it('counts a member who came back to the same meetup, until its group closes', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[5].id);
    await admitTelegramMember(db, {
      inviteLink,
      chatId: CHAT,
      telegramUserId: ACCOUNT,
      now: new Date(),
    });
    await takeTelegramInvite(db, { eventId, userId: members[5].id });
    const memberOf = () =>
      isTelegramMemberOfChat(db, { chatId: CHAT, telegramUserId: ACCOUNT });
    expect(await memberOf()).toBe(false);

    await admitTelegramMember(db, {
      inviteLink: await invite(eventId, members[5].id),
      chatId: CHAT,
      telegramUserId: ACCOUNT,
      now: new Date(),
    });
    expect(await memberOf()).toBe(true);

    await closeTelegramGroup(db, { eventId, now: now() });
    expect(await memberOf()).toBe(false);
  });

  it('forgets the Telegram account a settled removal carried, and nothing else', async () => {
    const eventId = await seedEvent(db);
    const { id: notificationId } = await enqueueNotification(db, {
      id: id('ntf'),
      eventId,
      userId: members[0].id,
      channel: 'telegram',
      templateKey: 'telegram_member_removed',
      payload: { telegramChatId: CHAT, telegramUserId: ACCOUNT },
      sendAt: now(),
    });

    await forgetTelegramAccount(db, notificationId);

    expect((await getNotification(db, notificationId))?.payload).toEqual({
      telegramChatId: CHAT,
    });
  });
});
