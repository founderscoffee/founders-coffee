import { eq, memberProfiles } from '@founders-coffee/db';
import { describe, expect, it } from 'vitest';

import { acceptPhotoUpload, reservePhotoUpload } from './photo.js';
import { handleProfilePhotoRequest } from './photo-http.js';
import {
  landscapePng,
  setupPhotoOwner,
  testPhotoServices,
} from './photo.fixtures.js';

const services = testPhotoServices();

const get = (path: string) => {
  const url = new URL(`http://localhost${path}`);
  return handleProfilePhotoRequest(new Request(url), url);
};

const uploadedPhoto = async () => {
  const { db, userId } = await setupPhotoOwner();
  const reservation = await reservePhotoUpload(db, userId);
  if (!reservation.ok) throw reservation.error;
  const assetId = reservation.data.assetId;
  const stored = await acceptPhotoUpload(db, services, {
    userId,
    assetId,
    bytes: landscapePng(),
  });
  if (!stored.ok) throw stored.error;
  return { db, userId, assetId };
};

describe('profile photo delivery', () => {
  it('leaves every other path to the router', () => {
    const url = new URL('http://localhost/algeria');
    expect(handleProfilePhotoRequest(new Request(url), url)).toBeNull();
    const upload = new URL('http://localhost/api/profile/photo/pha_x');
    expect(handleProfilePhotoRequest(new Request(upload), upload)).toBeNull();
  });

  it('serves a published variant with a revalidating private cache policy', async () => {
    const { assetId } = await uploadedPhoto();

    const response = await get(`/media/profile/${assetId}/md`);
    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('image/webp');
    expect(response?.headers.get('cache-control')).toBe('private, no-cache');
    expect(response?.headers.get('vary')).toBe('Cookie');
    expect((await response?.arrayBuffer())?.byteLength).toBeGreaterThan(0);
  });

  it('answers a matching ETag with 304 and no body', async () => {
    const { assetId } = await uploadedPhoto();
    const first = await get(`/media/profile/${assetId}/sm`);
    const etag = first?.headers.get('etag') ?? '';
    expect(etag).not.toBe('');

    const url = new URL(`http://localhost/media/profile/${assetId}/sm`);
    const second = await handleProfilePhotoRequest(
      new Request(url, { headers: { 'if-none-match': etag } }),
      url,
    );
    expect(second?.status).toBe(304);
    expect(second?.headers.get('cache-control')).toBe('private, no-cache');
  });

  it('serves an uploaded avatar to anonymous visitors without a visibility toggle', async () => {
    const { assetId } = await uploadedPhoto();

    expect((await get(`/media/profile/${assetId}/md`))?.status).toBe(200);
  });

  it('stops serving the moment the photo is detached', async () => {
    const { db, userId, assetId } = await uploadedPhoto();
    expect((await get(`/media/profile/${assetId}/md`))?.status).toBe(200);

    await db
      .update(memberProfiles)
      .set({ photoAssetId: null })
      .where(eq(memberProfiles.userId, userId));

    expect((await get(`/media/profile/${assetId}/md`))?.status).toBe(404);
  });

  it('refuses an unknown asset, an unknown variant and a nested path alike', async () => {
    const { assetId } = await uploadedPhoto();

    expect((await get('/media/profile/pha_missing/md'))?.status).toBe(404);
    expect((await get(`/media/profile/${assetId}/original`))?.status).toBe(404);
    expect((await get(`/media/profile/${assetId}/md/extra`))?.status).toBe(404);
  });

  it('refuses an upload another site started', async () => {
    const url = new URL('http://localhost/api/profile/photo/pha_x');
    const response = await handleProfilePhotoRequest(
      new Request(url, {
        method: 'PUT',
        body: 'bytes',
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
      url,
    );

    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ code: 'cross_site_upload' });
  });

  it('refuses an upload with no session before it reads a byte', async () => {
    const url = new URL('http://localhost/api/profile/photo/pha_x');
    const response = await handleProfilePhotoRequest(
      new Request(url, { method: 'PUT', body: 'bytes' }),
      url,
    );

    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ code: 'unauthenticated' });
  });
});
