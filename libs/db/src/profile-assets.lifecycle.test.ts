import { eq } from 'drizzle-orm';
import { assert, describe, expect, it } from 'vitest';

import {
  attachReadyProfilePhoto,
  deleteProfileAsset,
  getDeliverableProfilePhoto,
  listCollectableProfileAssets,
  reserveProfileAsset,
  retireProfilePhoto,
} from './profile-assets.js';
import { profileFixture } from './profiles.fixtures.js';
import { memberProfiles, profileAssets, user } from './schema.js';

const LATER = new Date('2099-01-01T12:00:00Z');
const EARLIER = new Date('2000-01-01T12:00:00Z');

const readyPhoto = async (expiresAt = LATER) => {
  const { db, userId } = await profileFixture();
  const asset = await reserveProfileAsset(db, userId, expiresAt);
  assert(asset);
  await attachReadyProfilePhoto(db, {
    userId,
    assetId: asset.id,
    mimeType: 'image/webp',
    byteSize: 1024,
    width: 320,
    height: 240,
  });
  return { db, userId, assetId: asset.id };
};

const db_photoAssetId = async (
  db: Awaited<ReturnType<typeof profileFixture>>['db'],
  userId: string,
) => {
  const rows = await db
    .select({ photoAssetId: memberProfiles.photoAssetId })
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, userId));
  return rows[0]?.photoAssetId ?? null;
};

describe('profile asset lifecycle on real D1', () => {
  it('marks the asset ready and points the profile at it in one step', async () => {
    const { db, userId, assetId } = await readyPhoto();

    const rows = await db
      .select()
      .from(profileAssets)
      .where(eq(profileAssets.id, assetId));
    expect(rows[0]).toMatchObject({ status: 'ready', revision: 1 });
    const profiles = await db
      .select({ photoAssetId: memberProfiles.photoAssetId })
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, userId));
    expect(profiles[0]?.photoAssetId).toBe(assetId);
  });

  it('reports the first upload as attached with nothing replaced', async () => {
    const { db, userId } = await profileFixture();
    const asset = await reserveProfileAsset(db, userId, LATER);
    assert(asset);

    expect(
      await attachReadyProfilePhoto(db, {
        userId,
        assetId: asset.id,
        mimeType: 'image/webp',
        byteSize: 1,
        width: 320,
        height: 240,
      }),
    ).toEqual({ attached: true, replacedAssetId: null });
  });

  it('names the photo it replaced so the caller can retire it', async () => {
    const first = await readyPhoto();
    const second = await reserveProfileAsset(first.db, first.userId, LATER);
    assert(second);

    expect(
      await attachReadyProfilePhoto(first.db, {
        userId: first.userId,
        assetId: second.id,
        mimeType: 'image/webp',
        byteSize: 1,
        width: 320,
        height: 240,
      }),
    ).toEqual({ attached: true, replacedAssetId: first.assetId });
  });

  it('refuses a retired asset without pointing the profile at it', async () => {
    const current = await readyPhoto();
    const retired = await reserveProfileAsset(
      current.db,
      current.userId,
      LATER,
    );
    assert(retired);
    await retireProfilePhoto(current.db, current.userId, retired.id);

    expect(
      await attachReadyProfilePhoto(current.db, {
        userId: current.userId,
        assetId: retired.id,
        mimeType: 'image/webp',
        byteSize: 1,
        width: 320,
        height: 240,
      }),
    ).toEqual({ attached: false, replacedAssetId: null });

    const profiles = await db_photoAssetId(current.db, current.userId);
    expect(profiles).toBe(current.assetId);
  });

  it('refuses to promote an asset that is already ready', async () => {
    const { db, userId, assetId } = await readyPhoto();

    expect(
      await attachReadyProfilePhoto(db, {
        userId,
        assetId,
        mimeType: 'image/webp',
        byteSize: 1,
        width: 100,
        height: 100,
      }),
    ).toEqual({ attached: false, replacedAssetId: null });
  });

  it('delivers an uploaded ready avatar publicly without a publication flag', async () => {
    const { db, userId, assetId } = await readyPhoto();
    expect(await getDeliverableProfilePhoto(db, assetId)).toMatchObject({
      userId,
    });
  });

  it('withdraws a suppressed member’s photo even after they published it', async () => {
    const { db, userId, assetId } = await readyPhoto();
    expect(await getDeliverableProfilePhoto(db, assetId)).not.toBeNull();

    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, userId))
      .run();

    expect(await getDeliverableProfilePhoto(db, assetId)).toBeNull();
    expect(await getDeliverableProfilePhoto(db, assetId)).toBeNull();
  });

  it('retires a photo, unpublishes it and stops delivering it', async () => {
    const { db, userId, assetId } = await readyPhoto();

    expect(await retireProfilePhoto(db, userId, assetId)).toBe(true);
    expect(await getDeliverableProfilePhoto(db, assetId)).toBeNull();
    const profiles = await db
      .select({
        photoAssetId: memberProfiles.photoAssetId,
      })
      .from(memberProfiles)
      .where(eq(memberProfiles.userId, userId));
    expect(profiles[0]).toMatchObject({
      photoAssetId: null,
    });
  });

  it('collects a retired asset and an expired reservation, never an attached one', async () => {
    const attached = await readyPhoto();
    const abandoned = await profileFixture();
    const stale = await reserveProfileAsset(
      abandoned.db,
      abandoned.userId,
      EARLIER,
    );
    assert(stale);
    const retired = await readyPhoto();
    await retireProfilePhoto(retired.db, retired.userId, retired.assetId);

    const collectable = await listCollectableProfileAssets(
      attached.db,
      new Date('2050-01-01T00:00:00Z'),
      200,
    );
    const ids = collectable.map((row) => row.id);

    expect(ids).toContain(stale.id);
    expect(ids).toContain(retired.assetId);
    expect(ids).not.toContain(attached.assetId);
  });

  it('leaves a fresh reservation alone until it comes due', async () => {
    const { db, userId } = await profileFixture();
    const fresh = await reserveProfileAsset(db, userId, LATER);
    assert(fresh);

    const now = await listCollectableProfileAssets(db, new Date(), 200);
    expect(now.map((row) => row.id)).not.toContain(fresh.id);
  });

  it('forgets a collected asset', async () => {
    const { db, userId } = await profileFixture();
    const asset = await reserveProfileAsset(db, userId, EARLIER);
    assert(asset);

    await deleteProfileAsset(db, asset.id);

    const rows = await db
      .select()
      .from(profileAssets)
      .where(eq(profileAssets.id, asset.id));
    expect(rows).toEqual([]);
  });
});
