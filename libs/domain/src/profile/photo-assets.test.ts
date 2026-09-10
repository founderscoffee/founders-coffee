import { describe, expect, it } from 'vitest';

import {
  PROFILE_PHOTO_VARIANTS,
  profilePhotoObjectKey,
  profilePhotoVariantSchema,
  sniffProfilePhotoMime,
} from './assets.js';

const bytes = (...values: number[]) => new Uint8Array(values);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50);

describe('profile photo signatures', () => {
  it.each([
    ['image/jpeg', JPEG],
    ['image/png', PNG],
    ['image/webp', WEBP],
  ])('recognises %s from its first bytes', (mime, sample) => {
    expect(sniffProfilePhotoMime(sample)).toBe(mime);
  });

  it.each([
    ['an SVG document', '<svg xmlns="http://www.w3.org/2000/svg" />'],
    ['a GIF', 'GIF89a and then some bytes'],
    ['a script pretending to be an image', '#!/bin/sh\necho hi'],
  ])('refuses %s', (_label, text) => {
    expect(sniffProfilePhotoMime(new TextEncoder().encode(text))).toBeNull();
  });

  it('refuses a truncated header rather than reading past it', () => {
    expect(sniffProfilePhotoMime(bytes(0x89, 0x50))).toBeNull();
    expect(sniffProfilePhotoMime(new Uint8Array())).toBeNull();
  });

  it('refuses a RIFF container that is not WebP', () => {
    const wav = bytes(
      0x52,
      0x49,
      0x46,
      0x46,
      0,
      0,
      0,
      0,
      0x57,
      0x41,
      0x56,
      0x45,
    );
    expect(sniffProfilePhotoMime(wav)).toBeNull();
  });
});

describe('profile photo keys', () => {
  it('hangs every variant and the original off one prefix', () => {
    expect(profilePhotoObjectKey('profiles/pha_1', 'original')).toBe(
      'profiles/pha_1/original',
    );
    for (const variant of PROFILE_PHOTO_VARIANTS) {
      expect(profilePhotoObjectKey('profiles/pha_1', variant.name)).toBe(
        `profiles/pha_1/${variant.name}`,
      );
    }
  });

  it('accepts only the declared variant names', () => {
    expect(profilePhotoVariantSchema.safeParse('md').success).toBe(true);
    expect(profilePhotoVariantSchema.safeParse('sm').success).toBe(true);
    expect(profilePhotoVariantSchema.safeParse('original').success).toBe(false);
    expect(profilePhotoVariantSchema.safeParse('../secret').success).toBe(
      false,
    );
  });
});
