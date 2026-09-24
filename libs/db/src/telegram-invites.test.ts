import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { transitionEventStatus } from './events.js';
import type { Db } from './db.js';
import { cancelRsvp } from './rsvps.js';
import { eventRsvps } from './schema.js';
import { members, seedEvent, setupDb } from './rsvps.fixtures.js';
import { closeTelegramGroup } from './telegram-groups.js';
import {
  admitTelegramMember,
  deleteTelegramInvites,
  getTelegramInvite,
  isTelegramMemberElsewhere,
  listTelegramInvites,
  saveTelegramInvite,
  takeTelegramInvite,
} from './telegram-invites.js';
import { attend, connectGroup } from './telegram.fixtures.js';

let linkCounter = 0;
const nextLink = () => `https://t.me/+invite${++linkCounter}`;

let chatCounter = 0;

describe('libs/db — telegram invites (real D1 via Miniflare)', () => {
  let db: Db;
  const now = () => new Date();

  let CHAT: number;
  let OTHER_CHAT: number;
  let ACCOUNT: number;
  let OTHER_ACCOUNT: number;

  beforeEach(async () => {
    db = await setupDb();
    chatCounter += 2;
    CHAT = -1001000000000 - chatCounter;
    OTHER_CHAT = CHAT - 1;
    ACCOUNT = 7000000000 + chatCounter;
    OTHER_ACCOUNT = ACCOUNT + 1;
  });

  const invite = async (eventId: string, userId: string) => {
    const inviteLink = nextLink();
    await saveTelegramInvite(db, {
      id: `tgi_${linkCounter}`,
      eventId,
      userId,
      inviteLink,
      now: now(),
    });
    return inviteLink;
  };

  const liveMeetupWith = async (userId: string) => {
    const eventId = await seedEvent(db);
    await connectGroup(db, eventId, CHAT);
    await attend(db, eventId, userId);
    return { eventId, inviteLink: await invite(eventId, userId) };
  };

  it('keeps the first link a member was given and reports the second as spare', async () => {
    const eventId = await seedEvent(db);
    const first = await invite(eventId, members[0].id);

    const second = await saveTelegramInvite(db, {
      id: 'tgi_spare',
      eventId,
      userId: members[0].id,
      inviteLink: nextLink(),
      now: now(),
    });

    expect(second.written).toBe(false);
    expect(second.kept?.inviteLink).toBe(first);
    expect(await listTelegramInvites(db, eventId)).toHaveLength(1);
  });

  it('admits a going member through their link and binds their account to it', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[0].id);

    const admitted = await admitTelegramMember(db, {
      inviteLink,
      chatId: CHAT,
      telegramUserId: ACCOUNT,
    });

    expect(admitted).toMatchObject({ eventId, userId: members[0].id });
    expect(
      (await getTelegramInvite(db, { eventId, userId: members[0].id }))
        ?.telegramUserId,
    ).toBe(ACCOUNT);
    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: ACCOUNT,
      }),
    ).toBeDefined();
  });

  it('admits nobody else through a link its member already used', async () => {
    const { inviteLink } = await liveMeetupWith(members[0].id);
    await admitTelegramMember(db, {
      inviteLink,
      chatId: CHAT,
      telegramUserId: ACCOUNT,
    });

    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: OTHER_ACCOUNT,
      }),
    ).toBeUndefined();
  });

  it('refuses a link from another chat, or one this product never issued', async () => {
    const { inviteLink } = await liveMeetupWith(members[0].id);

    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: OTHER_CHAT,
        telegramUserId: ACCOUNT,
      }),
    ).toBeUndefined();
    expect(
      await admitTelegramMember(db, {
        inviteLink: 'https://t.me/+unknown',
        chatId: CHAT,
        telegramUserId: ACCOUNT,
      }),
    ).toBeUndefined();
  });

  it('refuses a member who is no longer going', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[1].id);
    await cancelRsvp(db, { eventId, userId: members[1].id });

    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: ACCOUNT,
      }),
    ).toBeUndefined();
  });

  it('refuses a member whose seat is not a going one', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[1].id);
    await db
      .update(eventRsvps)
      .set({ status: 'waitlist' })
      .where(
        and(
          eq(eventRsvps.eventId, eventId),
          eq(eventRsvps.userId, members[1].id),
        ),
      );

    expect(
      await admitTelegramMember(db, {
        inviteLink,
        chatId: CHAT,
        telegramUserId: ACCOUNT,
      }),
    ).toBeUndefined();
  });

  it('refuses once the group is closed or the meetup cancelled', async () => {
    const closed = await liveMeetupWith(members[2].id);
    await closeTelegramGroup(db, { eventId: closed.eventId, now: now() });
    const cancelled = await liveMeetupWith(members[2].id);
    await transitionEventStatus(
      db,
      cancelled.eventId,
      'published',
      'cancelled',
    );

    for (const { inviteLink } of [closed, cancelled])
      expect(
        await admitTelegramMember(db, {
          inviteLink,
          chatId: CHAT,
          telegramUserId: ACCOUNT,
        }),
      ).toBeUndefined();
  });

  it('hands back and deletes a withdrawn member invite in one step', async () => {
    const { eventId, inviteLink } = await liveMeetupWith(members[3].id);
    await admitTelegramMember(db, {
      inviteLink,
      chatId: CHAT,
      telegramUserId: ACCOUNT,
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
      }),
    ).toBeUndefined();
  });

  it('deletes every invite of a meetup when its group closes', async () => {
    const eventId = await seedEvent(db);
    await invite(eventId, members[0].id);
    await invite(eventId, members[1].id);

    expect(await deleteTelegramInvites(db, eventId)).toBe(2);
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
      });

    const elsewhere = () =>
      isTelegramMemberElsewhere(db, {
        chatId: CHAT,
        telegramUserId: ACCOUNT,
        exceptEventId: first.eventId,
      });

    expect(await elsewhere()).toBe(true);
    expect(
      await isTelegramMemberElsewhere(db, {
        chatId: OTHER_CHAT,
        telegramUserId: ACCOUNT,
        exceptEventId: first.eventId,
      }),
    ).toBe(false);

    await cancelRsvp(db, { eventId: second.eventId, userId: members[4].id });
    expect(await elsewhere()).toBe(false);
  });
});
