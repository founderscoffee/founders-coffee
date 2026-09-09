import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, getMemberProfile, user } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import { saveOwnerProfile } from './resolver.js';

const setup = async (name = 'Original') => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db
    .insert(user)
    .values({ id: userId, name, email: `${userId}@test.coffee` });
  return { db, userId };
};
const command = (changes: Record<string, unknown> = {}) =>
  profile.updateProfileSchema.parse({
    displayName: 'Amina',
    expectedRevision: 0,
    ...changes,
  });

describe('rejected profile saves name their reason', () => {
  it('says a photo is missing instead of blaming a revision conflict', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(db, userId, command());

    const rejected = await saveOwnerProfile(
      db,
      userId,
      command({ expectedRevision: 1, visibility: { photo: true } }),
    );

    expect(rejected).toMatchObject({
      ok: false,
      error: { code: 'profile_photo_unavailable' },
    });
    const stored = await getMemberProfile(db, userId);
    expect(stored?.profile.publishPhoto).toBe(false);
    expect(stored?.profile.revision).toBe(1);
  });

  it('still calls a moved revision a conflict when a photo is also requested', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(db, userId, command());

    const rejected = await saveOwnerProfile(
      db,
      userId,
      command({ expectedRevision: 0, visibility: { photo: true } }),
    );

    expect(rejected).toMatchObject({
      ok: false,
      error: { code: 'profile_conflict' },
    });
  });
});
