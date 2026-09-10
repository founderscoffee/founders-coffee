import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import type { Db } from './db.js';

import { getAccountPreferences } from './account-preferences.js';
import { getNotificationContact } from './notification-destinations.js';
import { registerPushToken, removePushToken } from './push.js';
import { createDb } from './db.js';
import { seed } from './seed.js';
import { user } from './schema.js';

const memberWithNoPreferencesRow = async (suffix: string) => {
  const db = createDb(env.DB);
  await seed(db);
  const userId = `usr_push_${suffix}`;
  await db
    .insert(user)
    .values({
      id: userId,
      name: 'Push Member',
      email: `${userId}@test.coffee`,
    })
    .onConflictDoNothing()
    .run();
  return { db, userId };
};

const register = (db: Db, userId: string, suffix: string) =>
  registerPushToken(db, {
    id: `pst_${suffix}`,
    userId,
    token: `tok_${suffix}`,
    platform: 'web',
    surface: 'pwa',
    marketCode: 'DZ',
  });

describe('registerPushToken records that push is on', () => {
  it('creates the preferences row for a member who has none', async () => {
    const { db, userId } = await memberWithNoPreferencesRow('first');

    await register(db, userId, 'first');

    expect(await getAccountPreferences(db, userId)).toMatchObject({
      preferences: { pushEnabled: true },
    });
  });

  it('makes that member reachable on push, which they were not before', async () => {
    const { db, userId } = await memberWithNoPreferencesRow('reach');
    expect((await getNotificationContact(db, userId))?.pushEnabled).toBe(false);

    await register(db, userId, 'reach');

    expect((await getNotificationContact(db, userId))?.pushEnabled).toBe(true);
  });

  it('leaves the switch on when a single device is removed', async () => {
    const { db, userId } = await memberWithNoPreferencesRow('removal');
    await register(db, userId, 'removal');

    await removePushToken(db, { token: 'tok_removal', userId });

    expect((await getNotificationContact(db, userId))?.pushEnabled).toBe(true);
  });
});
