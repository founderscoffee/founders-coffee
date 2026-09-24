import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, user } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import {
  readOwnerProfile,
  readPublicProfile,
  saveDisplayName,
  saveOwnerProfile,
} from './resolver.js';

const setup = async () => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db
    .insert(user)
    .values({ id: userId, name: 'Amina', email: `${userId}@test.coffee` });
  return { db, userId };
};

const building = (changes: Record<string, unknown> = {}) =>
  profile.updateProfileSchema.parse({
    displayName: 'Amina',
    expectedRevision: 0,
    headline: 'تطبيق محاسبة للمحلات الصغيرة',
    stage: 'building',
    ...changes,
  });

describe('what a member is building, and how far along it is (#89)', () => {
  it('keeps both private until each is published on its own', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(db, userId, building());

    expect(await readOwnerProfile(db, userId)).toMatchObject({
      data: { headline: 'تطبيق محاسبة للمحلات الصغيرة', stage: 'building' },
    });
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: { headline: null, stage: null },
    });

    await saveOwnerProfile(
      db,
      userId,
      building({ expectedRevision: 1, visibility: { stage: true } }),
    );
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: { headline: null, stage: 'building' },
    });

    await saveOwnerProfile(
      db,
      userId,
      building({ expectedRevision: 2, visibility: { headline: true } }),
    );
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: { headline: 'تطبيق محاسبة للمحلات الصغيرة', stage: null },
    });
  });

  it('survives a change of name, which saves nothing else', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(
      db,
      userId,
      building({ visibility: { headline: true, stage: true } }),
    );

    await saveDisplayName(db, userId, {
      displayName: 'Amina B.',
      expectedRevision: 1,
    });

    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: {
        displayName: 'Amina B.',
        headline: 'تطبيق محاسبة للمحلات الصغيرة',
        stage: 'building',
      },
    });
  });

  it('withdraws what is cleared, publication included', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(
      db,
      userId,
      building({ visibility: { headline: true, stage: true } }),
    );

    await saveOwnerProfile(
      db,
      userId,
      building({
        expectedRevision: 1,
        headline: '   ',
        stage: null,
        visibility: { headline: true, stage: true },
      }),
    );

    expect(await readOwnerProfile(db, userId)).toMatchObject({
      data: {
        headline: null,
        stage: null,
        visibility: { headline: false, stage: false },
      },
    });
  });
});
