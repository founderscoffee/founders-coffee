import { eq } from 'drizzle-orm';
import { assert, describe, expect, it } from 'vitest';

import { getMemberProfile, updateMemberProfile } from './member-profiles.js';
import { getOwnedProfileAsset, reserveProfileAsset } from './profile-assets.js';
import { profileChanges, profileFixture } from './profiles.fixtures.js';
import { memberProfiles, profileAssets, user } from './schema.js';

describe('owned profile assets on real D1', () => {
  it('reserves opaque keys and preserves expiry without exposing another owner', async () => {
    const { db, userId } = await profileFixture();
    const other = await profileFixture();
    const expiry = new Date('2099-01-01T12:00:00Z');
    const asset = await reserveProfileAsset(db, userId, expiry);
    assert(asset);
    expect(asset).toMatchObject({
      userId,
      status: 'pending',
      expiresAt: expiry,
      revision: 0,
    });
    expect(asset?.objectKey).toBe(`profiles/${asset?.id}`);
    expect(asset?.objectKey).not.toContain(userId);
    expect(await getOwnedProfileAsset(db, userId, asset.id)).toEqual(asset);
    expect(await getOwnedProfileAsset(db, other.userId, asset.id)).toBeNull();
    expect(await getOwnedProfileAsset(db, userId, 'missing')).toBeNull();
    expect(await reserveProfileAsset(db, 'missing', expiry)).toBeNull();
  });

  it('allows profile editing independently of whether a photo exists', async () => {
    const { db, userId } = await profileFixture();
    expect(
      await updateMemberProfile(db, {
        userId,
        displayName: 'Edited',
        expectedRevision: 0,
        changes: profileChanges,
      }),
    ).toMatchObject({ revision: 1, photoAssetId: null });
    expect(await getMemberProfile(db, userId)).toMatchObject({
      displayName: 'Edited',
    });
  });

  it('enforces asset ownership even if a future writer bypasses the repository', async () => {
    const { db, userId } = await profileFixture();
    const other = await profileFixture();
    const asset = await reserveProfileAsset(
      db,
      other.userId,
      new Date('2099-01-01'),
    );
    assert(asset);
    await expect(
      db
        .update(memberProfiles)
        .set({ photoAssetId: asset.id })
        .where(eq(memberProfiles.userId, userId)),
    ).rejects.toThrow();
    await db
      .update(memberProfiles)
      .set({ photoAssetId: asset.id })
      .where(eq(memberProfiles.userId, other.userId));
    await expect(
      db.delete(profileAssets).where(eq(profileAssets.id, asset.id)),
    ).rejects.toThrow();
    await db
      .update(memberProfiles)
      .set({ photoAssetId: null })
      .where(eq(memberProfiles.userId, other.userId));
    await db.delete(profileAssets).where(eq(profileAssets.id, asset.id));
    expect(await getOwnedProfileAsset(db, other.userId, asset.id)).toBeNull();
  });

  it.each([{ banned: true }, { accountState: 'closing' }])(
    'blocks restricted owners: %j',
    async (restriction) => {
      const { db, userId } = await profileFixture();
      const asset = await reserveProfileAsset(
        db,
        userId,
        new Date('2099-01-01'),
      );
      assert(asset);
      await db.update(user).set(restriction).where(eq(user.id, userId));
      expect(await getOwnedProfileAsset(db, userId, asset.id)).toBeNull();
      expect(
        await reserveProfileAsset(db, userId, new Date('2099-01-01')),
      ).toBeNull();
    },
  );
});
