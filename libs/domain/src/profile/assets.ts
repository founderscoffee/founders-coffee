import { z } from 'zod';

import { idSchema } from '@founders-coffee/core';

import { profileIdentitySchema } from './schemas.js';

export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_MAX_PIXELS = 16_000_000;
export const profilePhotoMimeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
]);
export const profileAssetStatusSchema = z.enum([
  'pending',
  'processing',
  'ready',
  'deleting',
]);
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
