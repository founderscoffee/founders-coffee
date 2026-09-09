import { eq, getMemberProfile, profileAssets } from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import { describe, expect, it } from 'vitest';

import {
  acceptPhotoUpload,
  removeCurrentPhoto,
  reservePhotoUpload,
} from './photo.js';
import {
  landscapePng,
  notAnImage,
  setupPhotoOwner,
  testPhotoServices,
  tinyPng,
} from './photo.fixtures.js';

const services = testPhotoServices();

const reserved = async () => {
  const { db, userId } = await setupPhotoOwner();
  const reservation = await reservePhotoUpload(db, userId);
  if (!reservation.ok) throw reservation.error;
  return { db, userId, assetId: reservation.data.assetId };
};

const upload = (
  ctx: Awaited<ReturnType<typeof reserved>>,
  bytes = landscapePng(),
) =>
  acceptPhotoUpload(ctx.db, services, {
    userId: ctx.userId,
    assetId: ctx.assetId,
    bytes,
  });

describe('profile photos (real R2 and Images bindings)', () => {
  it('normalizes a landscape photo into square variants and attaches it', async () => {
    const ctx = await reserved();

    const result = await upload(ctx);
    expect(result).toMatchObject({ ok: true });

    const stored = await getMemberProfile(ctx.db, ctx.userId);
    expect(stored?.profile.photoAssetId).toBe(ctx.assetId);

    const rows = await ctx.db
      .select()
      .from(profileAssets)
      .where(eq(profileAssets.id, ctx.assetId));
    expect(rows[0]).toMatchObject({
      status: 'ready',
      mimeType: 'image/webp',
      width: 320,
      height: 240,
    });

    for (const variant of profile.PROFILE_PHOTO_VARIANTS) {
      const object = await services.store.get(
        profile.profilePhotoObjectKey(rows[0].objectKey, variant.name),
      );
      expect(object?.contentType).toBe('image/webp');
    }
    const original = await services.store.get(
      profile.profilePhotoObjectKey(rows[0].objectKey, 'original'),
    );
    expect(original?.contentType).toBe('image/png');
  });

  it('refuses anything that is not one of the three raster formats', async () => {
    const ctx = await reserved();

    expect(await upload(ctx, notAnImage())).toMatchObject({
      ok: false,
      error: { code: 'photo_unsupported' },
    });
    expect(await upload(ctx, new Uint8Array())).toMatchObject({
      ok: false,
      error: { code: 'validation_failed' },
    });
  });

  it('refuses a photo too small to crop into an avatar', async () => {
    const ctx = await reserved();

    expect(await upload(ctx, tinyPng())).toMatchObject({
      ok: false,
      error: { code: 'photo_too_small' },
    });
  });

  it('refuses a body past the byte cap before it decodes anything', async () => {
    const ctx = await reserved();
    const oversized = new Uint8Array(profile.PROFILE_PHOTO_MAX_BYTES + 1);
    oversized.set(landscapePng());

    expect(await upload(ctx, oversized)).toMatchObject({
      ok: false,
      error: { code: 'photo_too_large' },
    });
  });

  it('spends a reservation once and refuses the replay', async () => {
    const ctx = await reserved();
    expect(await upload(ctx)).toMatchObject({ ok: true });

    expect(await upload(ctx)).toMatchObject({
      ok: false,
      error: { code: 'photo_reservation_used' },
    });
  });

  it('refuses to attach an asset that is already retired, and leaves the profile alone', async () => {
    const ctx = await reserved();
    expect(await upload(ctx)).toMatchObject({ ok: true });
    await removeCurrentPhoto(ctx.db, ctx.userId);

    const replay = await acceptPhotoUpload(ctx.db, services, {
      userId: ctx.userId,
      assetId: ctx.assetId,
      bytes: landscapePng(),
    });

    expect(replay).toMatchObject({
      ok: false,
      error: { code: 'photo_reservation_used' },
    });
    const stored = await getMemberProfile(ctx.db, ctx.userId);
    expect(stored?.profile.photoAssetId).toBeNull();
  });

  it("refuses another member's reservation", async () => {
    const mine = await reserved();
    const theirs = await reserved();

    expect(
      await acceptPhotoUpload(mine.db, services, {
        userId: theirs.userId,
        assetId: mine.assetId,
        bytes: landscapePng(),
      }),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });

  it('retires the photo it replaced rather than leaving it behind', async () => {
    const first = await reserved();
    expect(await upload(first)).toMatchObject({ ok: true });

    const second = await reservePhotoUpload(first.db, first.userId);
    if (!second.ok) throw second.error;
    const replaced = await acceptPhotoUpload(first.db, services, {
      userId: first.userId,
      assetId: second.data.assetId,
      bytes: landscapePng(),
    });

    expect(replaced).toMatchObject({
      ok: true,
      data: { replacedAssetId: first.assetId },
    });
    const rows = await first.db
      .select()
      .from(profileAssets)
      .where(eq(profileAssets.id, first.assetId));
    expect(rows[0]?.status).toBe('deleting');
  });

  it('withdraws a photo and its publication in one step, and repeats safely', async () => {
    const ctx = await reserved();
    await upload(ctx);

    expect(await removeCurrentPhoto(ctx.db, ctx.userId)).toMatchObject({
      ok: true,
      data: { removedAssetId: ctx.assetId },
    });
    const stored = await getMemberProfile(ctx.db, ctx.userId);
    expect(stored?.profile.photoAssetId).toBeNull();

    expect(await removeCurrentPhoto(ctx.db, ctx.userId)).toMatchObject({
      ok: true,
      data: { removedAssetId: null },
    });
  });
});
