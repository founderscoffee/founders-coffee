import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, user } from '@founders-coffee/db';
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
  it('rejects the removed visibility flag at the input boundary', () => {
    expect(
      profile.updateProfileSchema.safeParse({
        displayName: 'Amina',
        expectedRevision: 0,
        visibility: { photo: true },
      }).success,
    ).toBe(false);
  });

  it('still calls a moved revision a conflict', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(db, userId, command());

    const rejected = await saveOwnerProfile(
      db,
      userId,
      command({ expectedRevision: 0 }),
    );

    expect(rejected).toMatchObject({
      ok: false,
      error: { code: 'profile_conflict' },
    });
  });
});
