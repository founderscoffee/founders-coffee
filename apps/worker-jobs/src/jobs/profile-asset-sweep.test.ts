import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  attachReadyProfilePhoto,
  createDb,
  eq,
  initializeMemberProfile,
  profileAssets,
  reserveProfileAsset,
  retireProfilePhoto,
  user,
  type Db,
} from '@founders-coffee/db';
import { R2PhotoStore } from '@founders-coffee/infra';

import { sweepProfileAssets } from './profile-asset-sweep.js';

const PAST = new Date('2000-01-01T00:00:00Z');
const FUTURE = new Date('2099-01-01T00:00:00Z');
const NOW = new Date('2050-01-01T00:00:00Z');

const bucket = () =>
  (env as unknown as { PROFILE_ASSETS: R2Bucket }).PROFILE_ASSETS;

const owner = async (): Promise<{ db: Db; userId: string }> => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db
    .insert(user)
    .values({ id: userId, name: 'Sweeper', email: `${userId}@test.coffee` });
  await initializeMemberProfile(db, userId);
  return { db, userId };
};

const withObjects = async (objectKey: string) => {
  const store = new R2PhotoStore(bucket());
  await store.put(`${objectKey}/original`, new Uint8Array([1]), 'image/png');
  await store.put(`${objectKey}/md`, new Uint8Array([2]), 'image/webp');
  return store;
};

describe('profile asset sweep (real D1 and R2)', () => {
  it('removes the bytes and the row of an abandoned reservation', async () => {
    const { db, userId } = await owner();
    const asset = await reserveProfileAsset(db, userId, PAST);
    if (!asset) throw new Error('reservation failed');
    const store = await withObjects(asset.objectKey);

    const result = await sweepProfileAssets(db, store, NOW, 200);

    expect(result.collected).toBeGreaterThanOrEqual(1);
    expect(await store.get(`${asset.objectKey}/md`)).toBeNull();
    expect(
      await db
        .select()
        .from(profileAssets)
        .where(eq(profileAssets.id, asset.id)),
    ).toEqual([]);
  });

  it('leaves an attached photo alone and collects it once it is retired', async () => {
    const { db, userId } = await owner();
    const asset = await reserveProfileAsset(db, userId, PAST);
    if (!asset) throw new Error('reservation failed');
    const store = await withObjects(asset.objectKey);
    await attachReadyProfilePhoto(db, {
      userId,
      assetId: asset.id,
      mimeType: 'image/webp',
      byteSize: 1,
      width: 320,
      height: 240,
    });

    await sweepProfileAssets(db, store, NOW, 200);
    expect(await store.get(`${asset.objectKey}/md`)).not.toBeNull();

    await retireProfilePhoto(db, userId, asset.id);
    await sweepProfileAssets(db, store, NOW, 200);

    expect(await store.get(`${asset.objectKey}/md`)).toBeNull();
    expect(
      await db
        .select()
        .from(profileAssets)
        .where(eq(profileAssets.id, asset.id)),
    ).toEqual([]);
  });

  it('leaves a reservation that has not come due', async () => {
    const { db, userId } = await owner();
    const asset = await reserveProfileAsset(db, userId, FUTURE);
    if (!asset) throw new Error('reservation failed');
    const store = await withObjects(asset.objectKey);

    await sweepProfileAssets(db, store, NOW, 200);

    expect(await store.get(`${asset.objectKey}/original`)).not.toBeNull();
  });

  it('keeps going when one asset cannot be removed', async () => {
    const { db, userId } = await owner();
    const asset = await reserveProfileAsset(db, userId, PAST);
    if (!asset) throw new Error('reservation failed');
    const store = new R2PhotoStore(bucket());
    const failing = {
      ...store,
      deletePrefix: (prefix: string) =>
        prefix.includes(asset.id)
          ? Promise.reject(new Error('R2 unavailable'))
          : store.deletePrefix(prefix),
    };

    const result = await sweepProfileAssets(db, failing, NOW, 200);

    expect(result.failed).toBe(1);
    expect(
      await db
        .select()
        .from(profileAssets)
        .where(eq(profileAssets.id, asset.id)),
    ).toHaveLength(1);
  });
});
