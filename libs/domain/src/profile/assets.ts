import { z } from 'zod';

import {
  idSchema,
  profileAssetStatusSchema,
  profilePhotoMimeSchema,
  type ProfilePhotoMimeType,
} from '@founders-coffee/core';

import { profileIdentitySchema } from './schemas.js';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_PIXELS = 16_000_000;
export type {
  ProfileAssetStatus,
  ProfilePhotoMimeType,
} from '@founders-coffee/core';
export const profilePhotoMetadataSchema = z
  .strictObject({
    mimeType: profilePhotoMimeSchema,
    byteSize: z.number().int().positive().max(PROFILE_PHOTO_MAX_BYTES),
    width: z.number().int().positive().max(PROFILE_PHOTO_MAX_PIXELS),
    height: z.number().int().positive().max(PROFILE_PHOTO_MAX_PIXELS),
  })
  .refine(
    (value) => value.width * value.height <= PROFILE_PHOTO_MAX_PIXELS,
    'Photo dimensions exceed the pixel limit',
  );

export const profileAssetSchema = z.strictObject({
  id: idSchema,
  userId: profileIdentitySchema,
  status: profileAssetStatusSchema,
  metadata: profilePhotoMetadataSchema.nullable(),
});

export const PROFILE_PHOTO_VARIANTS = [
  { name: 'md', pixels: 256 },
  { name: 'sm', pixels: 96 },
] as const;

export type ProfilePhotoVariant =
  (typeof PROFILE_PHOTO_VARIANTS)[number]['name'];

export const PROFILE_PHOTO_DELIVERY_FORMAT = 'image/webp';
export const PROFILE_PHOTO_MIN_PIXELS = 64;
export const PROFILE_PHOTO_RESERVATION_MINUTES = 15;

export const profilePhotoVariantSchema = z.enum(
  PROFILE_PHOTO_VARIANTS.map((variant) => variant.name) as [
    ProfilePhotoVariant,
    ...ProfilePhotoVariant[],
  ],
);

/**
 * Where one derived size of an asset lives in the bucket.
 *
 * The stored `object_key` is the prefix, not a file: originals and every variant hang off it, so a
 * withdrawal deletes a prefix rather than a list of names somebody has to keep in step with
 * {@link PROFILE_PHOTO_VARIANTS}. Adding a size adds a key here and nowhere else.
 */
export const profilePhotoObjectKey = (
  objectKeyPrefix: string,
  variant: ProfilePhotoVariant | 'original',
): string => `${objectKeyPrefix}/${variant}`;

/**
 * The signatures a decoder would accept, checked before one runs.
 *
 * A declared content type is a claim by the uploader. These are the first bytes of the three
 * formats this product accepts, and anything else — an SVG, an animated GIF, a polyglot with a
 * JPEG header glued to a script — is refused before it reaches an image pipeline at all.
 */
export const sniffProfilePhotoMime = (
  bytes: Uint8Array,
): ProfilePhotoMimeType | null => {
  const at = (index: number) => bytes[index];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  )
    return 'image/png';
  if (
    at(0) === 0x52 &&
    at(1) === 0x49 &&
    at(2) === 0x46 &&
    at(3) === 0x46 &&
    at(8) === 0x57 &&
    at(9) === 0x45 &&
    at(10) === 0x42 &&
    at(11) === 0x50
  )
    return 'image/webp';
  return null;
};
