import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';
import {
  createDb,
  initializeMemberProfile,
  user,
  type Db,
} from '@founders-coffee/db';
import {
  CloudflareImagesNormalizer,
  R2PhotoStore,
} from '@founders-coffee/infra';

import type { PhotoServices } from './photo.js';

const LANDSCAPE_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAUAAAADwCAIAAAD+Tyo8AAACD0lEQVR42u3TQQkAAAgEwYtoHCMayw7+hIFJsLCpHuCpSAAGBgwMGBgMDBgYMDBgYDAwYGDAwGBgwMCAgQEDg4EBAwMGBgwMBgYMDBgYDAwYGDAwYGAwMGBgwMCAgcHAgIEBA4OBAQMDBgYMDAYGDAwYGAysAhgYMDBgYDAwYGDAwICBwcCAgQEDg4EBAwMGBgwMBgYMDBgYMDAYGDAwYGAwMGBgwMCAgcHAgIEBAwMGBgMDBgYMDAYGDAwYGDAwGBgwMGBgMDBgYMDAgIHBwICBAQMDBgYDAwYGDAwGBgwMGBgwMBgYMDBgYMDAYGDAwICBwcCAgQEDAwYGAwMGBgwMGBgMDBgYMDAYGDAwYGDAwGBgwMCAgcHAgIEBAwMGBgMDBgYMDBgYDAwYGDAwGBgwMGBgwMBgYMDAgIEBA4OBAQMDBgYDAwYGDAwYGAwMGBgwMBhYBTAwYGDAwGBgwMCAgQEDg4EBAwMGBgMDBgYMDBgYDAwYGDAwYGAwMGBgwMBgYMDAgIEBA4OBAQMDBgYMDAYGDAwYGAwMGBgwMGBgMDBgYMDAYGDAwICBAQODgQEDAwYGDAwGBgwMGBgMDBgYMDBgYDAwYGDAwICBwcCAgQEDg4EBAwMGBgwMBgYMDBgYMDAYGDAwYGAwMGBgwMCAgcHAgIEBA4OBAQMDBgYMDAYGDAwYGDAwGBgwMHC3MGjbbQqstsQAAAAASUVORK5CYII=';
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAKklEQVR42mMIqDhBU8QwasGoBaMWjFowasGoBaMWjFowasGoBaMWDBULAGR8QFsdVM7cAAAAAElFTkSuQmCC';

const decode = (base64: string): Uint8Array =>
  Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));

/** A 320x240 solid PNG — large enough to crop, small enough to inline. */
export const landscapePng = (): Uint8Array => decode(LANDSCAPE_PNG);

/** A 32x32 PNG, below the minimum an avatar is allowed to be. */
export const tinyPng = (): Uint8Array => decode(TINY_PNG);

/** Bytes that pass no signature check, for the path that must refuse before decoding. */
export const notAnImage = (): Uint8Array =>
  new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

export const testPhotoServices = (): PhotoServices => {
  const bindings = env as unknown as {
    PROFILE_ASSETS: R2Bucket;
    IMAGES: ImagesBinding;
  };
  return {
    store: new R2PhotoStore(bindings.PROFILE_ASSETS),
    normalizer: new CloudflareImagesNormalizer(bindings.IMAGES),
  };
};

export const setupPhotoOwner = async (): Promise<{
  db: Db;
  userId: string;
}> => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db
    .insert(user)
    .values({
      id: userId,
      name: 'Photo Owner',
      email: `${userId}@test.coffee`,
    });
  await initializeMemberProfile(db, userId);
  return { db, userId };
};
