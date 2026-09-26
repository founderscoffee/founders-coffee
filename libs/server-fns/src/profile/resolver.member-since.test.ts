import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, user } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import {
  readOwnerProfile,
  readPublicProfile,
  saveOwnerProfile,
} from './resolver.js';

const JOINED = new Date('2025-11-15T09:41:27Z');

const joinedMember = async () => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Amina',
    email: `${userId}@test.coffee`,
    createdAt: JOINED,
  });
  return { db, userId };
};

describe('member since, from the account itself (#89)', () => {
  it('publishes the month the account was created and nothing finer', async () => {
    const { db, userId } = await joinedMember();

    const result = await readPublicProfile(db, userId);

    expect(result).toMatchObject({
      ok: true,
      data: { memberSince: '2025-11' },
    });
    const response = JSON.stringify(result);
    expect(response).not.toContain('2025-11-15');
    expect(response).not.toContain(String(JOINED.getTime() / 1000));
    expect(response).not.toContain('09:41');
  });

  it('is part of every owner response, including the one a save returns', async () => {
    const { db, userId } = await joinedMember();

    expect(await readOwnerProfile(db, userId)).toMatchObject({
      data: { memberSince: '2025-11' },
    });
    expect(
      await saveOwnerProfile(
        db,
        userId,
        profile.updateProfileSchema.parse({
          displayName: 'Amina',
          expectedRevision: 0,
        }),
      ),
    ).toMatchObject({ ok: true, data: { memberSince: '2025-11' } });
  });
});
