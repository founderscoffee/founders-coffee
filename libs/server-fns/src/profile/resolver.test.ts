import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  createDb,
  eq,
  getMemberProfile,
  memberProfiles,
  user,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';

import {
  readOwnerProfile,
  readPublicProfile,
  saveDisplayName,
  saveOwnerProfile,
} from './resolver.js';
import {
  emptyProfileRequestSchema,
  publicProfileRequestSchema,
  updateDisplayNameRequestSchema,
  updateProfileRequestSchema,
} from './schemas.js';

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

describe('PF-03 profile resolvers against real D1', () => {
  it('reads private defaults without writing or exposing identity fields', async () => {
    const { db, userId } = await setup('');
    const result = await readOwnerProfile(db, userId);
    expect(result).toMatchObject({
      ok: true,
      data: { userId, displayName: '', revision: 0, photoAssetId: null },
    });
    expect(await getMemberProfile(db, userId)).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(
      /email|phone|home|role|token|banned|localePref/,
    );
    expect(await readPublicProfile(db, userId)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
  it('saves name-only completion without residence and returns explicit public data', async () => {
    const { db, userId } = await setup('');
    expect(
      await saveDisplayName(db, userId, {
        displayName: 'أمينة',
        expectedRevision: 0,
      }),
    ).toMatchObject({
      ok: true,
      data: {
        displayName: 'أمينة',
        revision: 1,
        interests: [],
        visibility: { professionalLink: false },
      },
    });
    const result = await readPublicProfile(db, userId);
    expect(result).toEqual({
      ok: true,
      data: {
        userId,
        displayName: 'أمينة',
        photoAssetId: null,
        memberSince: expect.stringMatching(/^\d{4}-\d{2}$/),
        headline: null,
        stage: null,
        introduction: null,
        interests: [],
        spokenLanguages: [],
        professionalLink: null,
        attendedCount: null,
      },
    });
  });
  it('publishes introductions immediately while keeping other details opt-in', async () => {
    const { db, userId } = await setup();
    const details = {
      introduction: 'Public introduction',
      interests: ['community'],
      spokenLanguages: ['ar'],
      professionalLink: 'https://example.com',
    };
    expect((await saveOwnerProfile(db, userId, command(details))).ok).toBe(
      true,
    );
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: {
        introduction: 'Public introduction',
        interests: [],
      },
    });
    expect(
      (
        await saveOwnerProfile(
          db,
          userId,
          command({
            ...details,
            expectedRevision: 1,
            visibility: { professionalLink: true },
          }),
        )
      ).ok,
    ).toBe(true);
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: {
        introduction: 'Public introduction',
        professionalLink: 'https://example.com',
      },
    });
    expect(
      (await saveOwnerProfile(db, userId, command({ expectedRevision: 2 }))).ok,
    ).toBe(true);
    expect(await readPublicProfile(db, userId)).toMatchObject({
      data: { introduction: null },
    });
  });
  it('rejects stale saves and preserves optional data on name-only updates', async () => {
    const { db, userId } = await setup();
    await saveOwnerProfile(db, userId, command({ introduction: 'Keep me' }));
    expect(
      await saveDisplayName(db, userId, {
        displayName: 'Stale',
        expectedRevision: 0,
      }),
    ).toMatchObject({ ok: false, error: { code: 'profile_conflict' } });
    expect(
      await saveDisplayName(db, userId, {
        displayName: 'Updated',
        expectedRevision: 1,
      }),
    ).toMatchObject({
      ok: true,
      data: { displayName: 'Updated', introduction: 'Keep me', revision: 2 },
    });
    const results = await Promise.all(
      ['One', 'Two'].map((displayName) =>
        saveDisplayName(db, userId, { displayName, expectedRevision: 2 }),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });
  it('does not expose contact-derived names or allow them to be republished', async () => {
    const { db, userId } = await setup();
    const email = `${userId}@test.coffee`;
    await db.update(user).set({ name: email }).where(eq(user.id, userId));
    expect(await readPublicProfile(db, userId)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
    expect(
      await saveOwnerProfile(db, userId, command({ displayName: email })),
    ).toMatchObject({ ok: false, error: { code: 'validation_failed' } });
  });
  it.each([
    { banned: true },
    { accountState: 'deletion_pending' },
    { accountState: 'deleted' },
  ])('hides inactive identities %j', async (state) => {
    const { db, userId } = await setup();
    await db.update(user).set(state).where(eq(user.id, userId));
    for (const result of [
      await readOwnerProfile(db, userId),
      await readPublicProfile(db, userId),
      await saveOwnerProfile(db, userId, command()),
      await saveDisplayName(db, userId, {
        displayName: 'No',
        expectedRevision: 0,
      }),
    ]) {
      expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
    }
  });
  it('keeps two owners isolated and wraps malformed stored data in a safe failure', async () => {
    const first = await setup();
    const second = await setup();
    await saveOwnerProfile(first.db, first.userId, command());
    expect(await readOwnerProfile(second.db, second.userId)).toMatchObject({
      data: { displayName: 'Original', revision: 0 },
    });
    await first.db
      .update(memberProfiles)
      .set({ interests: ['invalid'] })
      .where(eq(memberProfiles.userId, first.userId));
    expect(await readOwnerProfile(first.db, first.userId)).toMatchObject({
      ok: false,
      error: {
        code: 'profile_unavailable',
        message: 'Profile is temporarily unavailable',
      },
    });
    expect(await readOwnerProfile(first.db, 'usr_missing')).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });
});

describe('PF-03 strict request boundaries', () => {
  it.each([
    'userId',
    'email',
    'phoneNumber',
    'role',
    'homeMarketCode',
    'homeState',
    'homeCityId',
    'photoAssetId',
    'revision',
  ])('rejects client assignment of %s', (field) => {
    expect(
      updateProfileRequestSchema.safeParse({
        profile: {
          displayName: 'Amina',
          expectedRevision: 0,
          [field]: 'spoofed',
        },
      }).success,
    ).toBe(false);
    expect(
      updateDisplayNameRequestSchema.safeParse({
        displayName: 'Amina',
        expectedRevision: 0,
        [field]: 'spoofed',
      }).success,
    ).toBe(false);
  });
  it('rejects owner selectors, unbounded public ids, invalid revisions and legacy security fields', () => {
    expect(
      emptyProfileRequestSchema.safeParse({ userId: 'victim' }).success,
    ).toBe(false);
    expect(
      publicProfileRequestSchema.safeParse({ userId: 'x'.repeat(129) }).success,
    ).toBe(false);
    expect(
      publicProfileRequestSchema.safeParse({
        userId: 'usr_1',
        email: 'private',
      }).success,
    ).toBe(false);
    expect(
      updateDisplayNameRequestSchema.safeParse({
        displayName: ' ',
        expectedRevision: -1,
      }).success,
    ).toBe(false);
    expect(
      updateDisplayNameRequestSchema.safeParse({
        displayName: 'Amina',
        expectedRevision: 0,
        turnstileToken: 'legacy',
      }).success,
    ).toBe(false);
  });
});
