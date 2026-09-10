import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  attachReadyProfilePhoto,
  getOwnedProfileAsset,
  getMemberProfile,
  reserveProfileAsset,
  retireProfilePhoto,
  type Db,
} from '@founders-coffee/db';
import { profile } from '@founders-coffee/domain';
import type { PhotoNormalizer, PhotoStore } from '@founders-coffee/infra';
import { logger } from '@founders-coffee/observability';

export interface PhotoServices {
  readonly store: PhotoStore;
  readonly normalizer: PhotoNormalizer;
}

export interface PhotoReservation {
  readonly assetId: string;
  readonly expiresAt: number;
}

const RESERVATION_MS = profile.PROFILE_PHOTO_RESERVATION_MINUTES * 60_000;

const rejected = (code: string, message: string) =>
  err(new AppError(code, message));

/**
 * Claim a key to upload into, before a single byte is accepted.
 *
 * Splitting reservation from transfer is what lets the cheap half carry the bot challenge and the
 * expensive half carry a bounded body: a challenge cannot ride along on a raw image stream, and a
 * multi-megabyte request should not be the first thing an unproven caller gets to send. The
 * reservation expires on its own, so a member who changes their mind costs a row that the sweeper
 * collects rather than an object nobody remembers.
 */
export const reservePhotoUpload = async (
  db: Db,
  userId: string,
  now = new Date(),
): Promise<Result<PhotoReservation>> => {
  const expiresAt = new Date(now.getTime() + RESERVATION_MS);
  const asset = await reserveProfileAsset(db, userId, expiresAt);
  if (!asset) return rejected('not_found', 'Profile is no longer available');
  return ok({ assetId: asset.id, expiresAt: expiresAt.getTime() });
};

/**
 * Decide whether these bytes are a photograph, before any of them are stored.
 *
 * The declared content type is a claim by the uploader, so the signature is checked first and the
 * decoder second. An SVG answers `info` without dimensions — it is a document, not a raster, and
 * the one format most worth refusing here because it can carry script. Everything that survives
 * both checks is a bitmap the encoder can read.
 */
const inspect = async (
  services: PhotoServices,
  bytes: Uint8Array,
): Promise<Result<{ width: number; height: number; sourceMime: string }>> => {
  if (bytes.byteLength === 0)
    return rejected('validation_failed', 'Empty upload');
  if (bytes.byteLength > profile.PROFILE_PHOTO_MAX_BYTES)
    return rejected('photo_too_large', 'Choose a photo under 5 MB');
  const sourceMime = profile.sniffProfilePhotoMime(bytes);
  if (!sourceMime)
    return rejected('photo_unsupported', 'Use a JPEG, PNG or WebP photo');

  const described = await services.normalizer.describe(bytes);
  if (!described)
    return rejected('photo_unsupported', 'Use a JPEG, PNG or WebP photo');
  const { width, height } = described;
  if (
    width < profile.PROFILE_PHOTO_MIN_PIXELS ||
    height < profile.PROFILE_PHOTO_MIN_PIXELS
  )
    return rejected('photo_too_small', 'Use a photo at least 64 pixels wide');
  if (width * height > profile.PROFILE_PHOTO_MAX_PIXELS)
    return rejected('photo_too_large', 'Choose a smaller photo');
  return ok({ width, height, sourceMime });
};

/**
 * Accept an upload against a reservation: validate, re-encode, store, then attach.
 *
 * The order is the contract. Nothing is written until the bytes have been proven to decode, the
 * variants are written before the row is told they exist, and the profile only points at the asset
 * once both are true — so a failure at any step leaves the member with the photo they already had
 * rather than a broken one. The original is kept because a future size cannot be derived from a
 * 96-pixel square, and it is never served: only variants have a delivery path.
 */
export const acceptPhotoUpload = async (
  db: Db,
  services: PhotoServices,
  input: { userId: string; assetId: string; bytes: Uint8Array },
): Promise<Result<{ assetId: string; replacedAssetId: string | null }>> => {
  const asset = await getOwnedProfileAsset(db, input.userId, input.assetId);
  if (!asset) return rejected('not_found', 'Upload was not reserved');
  if (asset.status !== 'pending')
    return rejected('photo_reservation_used', 'Start the upload again');
  if (asset.expiresAt.getTime() <= Date.now())
    return rejected('photo_reservation_expired', 'Start the upload again');

  const inspected = await inspect(services, input.bytes);
  if (!inspected.ok) return inspected;

  const variants = await Promise.all(
    profile.PROFILE_PHOTO_VARIANTS.map(async (variant) => ({
      key: profile.profilePhotoObjectKey(asset.objectKey, variant.name),
      ...(await services.normalizer.square(input.bytes, variant.pixels)),
    })),
  );
  await services.store.put(
    profile.profilePhotoObjectKey(asset.objectKey, 'original'),
    input.bytes,
    inspected.data.sourceMime,
  );
  await Promise.all(
    variants.map((variant) =>
      services.store.put(variant.key, variant.bytes, variant.contentType),
    ),
  );

  const attached = await attachReadyProfilePhoto(db, {
    userId: input.userId,
    assetId: input.assetId,
    mimeType: profile.PROFILE_PHOTO_DELIVERY_FORMAT,
    byteSize: input.bytes.byteLength,
    width: inspected.data.width,
    height: inspected.data.height,
  });
  if (!attached.attached)
    return rejected('photo_reservation_used', 'Start the upload again');
  const { replacedAssetId } = attached;
  if (replacedAssetId)
    await retireProfilePhoto(db, input.userId, replacedAssetId);
  logger.info('profile_photo_stored', {
    userId: input.userId,
    assetId: input.assetId,
  });
  return ok({ assetId: input.assetId, replacedAssetId });
};

/** Withdraw the current photo. Idempotent: a member with none is already where they asked to be. */
export const removeCurrentPhoto = async (
  db: Db,
  userId: string,
): Promise<Result<{ removedAssetId: string | null }>> => {
  const stored = await getMemberProfile(db, userId);
  if (!stored) return rejected('not_found', 'Profile not found');
  const assetId = stored.profile.photoAssetId;
  if (!assetId) return ok({ removedAssetId: null });
  await retireProfilePhoto(db, userId, assetId);
  return ok({ removedAssetId: assetId });
};
