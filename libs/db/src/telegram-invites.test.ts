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
  getTelegramInvite,
  listTelegramInvites,
  saveTelegramInvite,
} from './telegram-invites.js';
import {
  inviteTo,
  liveMeetupFor,
  nextLink,
  telegramIds,
} from './telegram.fixtures.js';

describe('libs/db — telegram invites (real D1 via Miniflare)', () => {
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
});
