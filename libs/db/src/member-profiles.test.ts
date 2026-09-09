import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  getMemberProfile,
  initializeMemberProfile,
  updateMemberProfile,
} from './member-profiles.js';
import { getAccountPreferences } from './account-preferences.js';
import { profileChanges, profileFixture } from './profiles.fixtures.js';
import { accountPreferences, memberProfiles, user } from './schema.js';

describe('member profiles on real D1', () => {
  it('initializes once without home geography or exposing contact data', async () => {
    const { db, userId } = await profileFixture();
    await Promise.all(
      Array.from({ length: 4 }, () => initializeMemberProfile(db, userId)),
    );
    const result = await getMemberProfile(db, userId);
    expect(result).toMatchObject({
      displayName: 'Original',
      locale: null,
      profile: {
        userId,
        revision: 0,
        interests: [],
        spokenLanguages: [],
        introduction: null,
        photoAssetId: null,
      },
    });
    expect(Object.keys(result ?? {})).toEqual([
      'displayName',
      'locale',
      'profile',
    ]);
    expect(JSON.stringify(result)).not.toContain('@test.coffee');
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      preferences: { revision: 0 },
    });
    expect(await getMemberProfile(db, 'missing')).toBeNull();
    await initializeMemberProfile(db, 'missing');
    expect(await getMemberProfile(db, 'missing')).toBeNull();
  });

  it('updates name and profile atomically and rejects stale revisions', async () => {
    const { db, userId } = await profileFixture();
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Updated',
        expectedRevision: 0,
        changes: profileChanges,
      }),
    ).toMatchObject({ revision: 1, introduction: 'Community first' });
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Stale',
        expectedRevision: 0,
        changes: { ...profileChanges, introduction: 'Lost edit' },
      }),
    ).toBeNull();
    expect(await getMemberProfile(db, userId)).toMatchObject({
      displayName: 'Updated',
      profile: { revision: 1, introduction: 'Community first' },
    });
    await initializeMemberProfile(db, userId);
    expect(await getMemberProfile(db, userId)).toMatchObject({
      profile: { revision: 1 },
    });
  });

  it('allows exactly one concurrent edit and does not mix display names and fields', async () => {
    const { db, userId } = await profileFixture();
    const results = await Promise.all(
      ['First', 'Second'].map((name) =>
        updateMemberProfile(db, {
          userId,
          displayName: name,
          expectedRevision: 0,
          changes: { ...profileChanges, introduction: name },
        }),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const saved = await getMemberProfile(db, userId);
    expect(saved?.profile.revision).toBe(1);
    expect(saved?.displayName).toBe(saved?.profile.introduction);
  });

  it.each([
    { banned: true },
    { accountState: 'closing' },
    { accountState: 'deleted' },
  ])('blocks inactive identities: %j', async (restriction) => {
    const { db, userId } = await profileFixture();
    await db.update(user).set(restriction).where(eq(user.id, userId));
    expect(await getMemberProfile(db, userId)).toBeNull();
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Blocked',
        expectedRevision: 0,
        changes: profileChanges,
      }),
    ).toBeNull();
    expect(
      (await db.select().from(user).where(eq(user.id, userId)))[0]?.name,
    ).toBe('Original');
    await db.delete(memberProfiles).where(eq(memberProfiles.userId, userId));
    await initializeMemberProfile(db, userId);
    expect(
      await db
        .select()
        .from(memberProfiles)
        .where(eq(memberProfiles.userId, userId)),
    ).toEqual([]);
  });

  it('never changes another owner or protected fields through extra object keys', async () => {
    const { db, userId } = await profileFixture({ banned: null });
    const other = await profileFixture();
    const changes = {
      ...profileChanges,
      userId: other.userId,
      revision: 100,
      photoAssetId: 'chosen-key',
    };
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Updated',
        expectedRevision: 0,
        changes,
      }),
    ).toMatchObject({ userId, revision: 1, photoAssetId: null });
    expect(await getMemberProfile(db, other.userId)).toMatchObject({
      displayName: 'Original',
      profile: { revision: 0 },
    });
  });

  it('rolls back the display name if the profile write fails', async () => {
    const { db, userId } = await profileFixture();
    const changes = {
      ...profileChanges,
      interests: null,
    } as unknown as typeof profileChanges;
    await expect(
      updateMemberProfile(db, {
        userId,
        displayName: 'Must roll back',
        expectedRevision: 0,
        changes,
      }),
    ).rejects.toThrow();
    expect(await getMemberProfile(db, userId)).toMatchObject({
      displayName: 'Original',
      profile: { revision: 0 },
    });
  });

  it('clears optional values and repairs partial initialization without replacing saved data', async () => {
    const { db, userId } = await profileFixture();
    await updateMemberProfile(db, {
      userId,
      displayName: 'Updated',
      expectedRevision: 0,
      changes: profileChanges,
    });
    await db
      .delete(accountPreferences)
      .where(eq(accountPreferences.userId, userId));
    await initializeMemberProfile(db, userId);
    expect(await getMemberProfile(db, userId)).toMatchObject({
      profile: { revision: 1, introduction: 'Community first' },
    });
    expect(await getAccountPreferences(db, userId)).toMatchObject({
      preferences: { revision: 0 },
    });
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Updated',
        expectedRevision: 1,
        changes: {
          ...profileChanges,
          introduction: null,
          interests: [],
          spokenLanguages: [],
          professionalLink: null,
        },
      }),
    ).toMatchObject({
      revision: 2,
      introduction: null,
      interests: [],
      spokenLanguages: [],
      professionalLink: null,
    });
  });
});
