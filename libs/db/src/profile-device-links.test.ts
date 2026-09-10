import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import { profileFixture } from './profiles.fixtures.js';
import { linkPushSubscriptionToSession } from './profile-device-links.js';
import {
  pushSessionLinks,
  pushSubscriptions,
  session,
  user,
} from './schema.js';
import { seed } from './seed.js';

describe('push session ownership on real D1', () => {
  it('requires the subscription and session to belong to the same member', async () => {
    const { db, userId } = await profileFixture();
    const other = await profileFixture();
    await seed(db);
    const subscriptionId = id('psh');
    const sessionId = id('ses');
    const otherSessionId = id('ses');
    await db.insert(pushSubscriptions).values({
      id: subscriptionId,
      userId,
      token: id('tok'),
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    });
    await db.insert(session).values([
      {
        id: sessionId,
        userId,
        token: id('tok'),
        expiresAt: new Date('2099-01-01'),
      },
      {
        id: otherSessionId,
        userId: other.userId,
        token: id('tok'),
        expiresAt: new Date('2099-01-01'),
      },
    ]);
    await expect(
      db
        .insert(pushSessionLinks)
        .values({ subscriptionId, userId, sessionId: otherSessionId }),
    ).rejects.toThrow();
    await expect(
      db.insert(pushSessionLinks).values({
        subscriptionId,
        userId: other.userId,
        sessionId: otherSessionId,
      }),
    ).rejects.toThrow();
    expect(
      await linkPushSubscriptionToSession(db, {
        subscriptionId,
        userId,
        sessionId: otherSessionId,
      }),
    ).toBe(false);
    expect(
      await linkPushSubscriptionToSession(db, {
        subscriptionId,
        userId,
        sessionId: 'missing',
      }),
    ).toBe(false);
    expect(
      await linkPushSubscriptionToSession(db, {
        subscriptionId,
        userId,
        sessionId,
      }),
    ).toBe(true);
    expect(
      await linkPushSubscriptionToSession(db, {
        subscriptionId,
        userId,
        sessionId,
      }),
    ).toBe(true);
    await db.delete(session).where(eq(session.id, sessionId));
    expect(
      await db
        .select()
        .from(pushSessionLinks)
        .where(eq(pushSessionLinks.subscriptionId, subscriptionId)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscriptionId)),
    ).toHaveLength(1);
    await db.insert(session).values({
      id: sessionId,
      userId,
      token: id('tok'),
      expiresAt: new Date('2099-01-01'),
    });
    await db
      .insert(pushSessionLinks)
      .values({ subscriptionId, userId, sessionId });
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, subscriptionId));
    expect(
      await db
        .select()
        .from(pushSessionLinks)
        .where(eq(pushSessionLinks.subscriptionId, subscriptionId)),
    ).toEqual([]);
  });

  it('does not associate expired sessions or restricted identities', async () => {
    const { db, userId } = await profileFixture();
    await seed(db);
    const input = { subscriptionId: id('psh'), sessionId: id('ses'), userId };
    await db.insert(pushSubscriptions).values({
      id: input.subscriptionId,
      userId,
      token: id('tok'),
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    });
    await db.insert(session).values({
      id: input.sessionId,
      userId,
      token: id('tok'),
      expiresAt: new Date(0),
    });
    expect(await linkPushSubscriptionToSession(db, input)).toBe(false);
    await db
      .update(session)
      .set({ expiresAt: new Date('2099-01-01') })
      .where(eq(session.id, input.sessionId));
    await db.update(user).set({ banned: true }).where(eq(user.id, userId));
    expect(await linkPushSubscriptionToSession(db, input)).toBe(false);
    await db
      .update(user)
      .set({ banned: false, accountState: 'closing' })
      .where(eq(user.id, userId));
    expect(await linkPushSubscriptionToSession(db, input)).toBe(false);
  });
});
