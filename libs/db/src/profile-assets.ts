import { and, eq, exists, lte, ne, notExists, sql } from 'drizzle-orm';

import { id, type ProfilePhotoMimeType } from '@founders-coffee/core';

import type { Db } from './db.js';
import { activeProfileIdentity, visibleIdentity } from './profile-access.js';
import { memberProfiles, profileAssets, user } from './schema.js';

/** Reserve an opaque owned asset key; uploads and processing are handled by the image service. */
export const reserveProfileAsset = async (
  db: Db,
  userId: string,
  expiresAt: Date,
) => {
  const assetId = id('pha');
  await db.run(sql`INSERT INTO ${profileAssets} (id, user_id, object_key, expires_at)
    SELECT ${assetId}, ${user.id}, ${`profiles/${assetId}`}, ${Math.floor(expiresAt.getTime() / 1000)}
    FROM ${user} WHERE ${activeProfileIdentity(userId)}`);
  return getOwnedProfileAsset(db, userId, assetId);
};

/** Read one owned photo, never an arbitrary key chosen from another member's profile. */
export const getOwnedProfileAsset = async (
  db: Db,
  userId: string,
  assetId: string,
) => {
  const rows = await db
    .select()
    .from(profileAssets)
    .where(
      and(
        eq(profileAssets.id, assetId),
        eq(profileAssets.userId, userId),
        exists(
          db
            .select({ id: user.id })
            .from(user)
            .where(activeProfileIdentity(userId)),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
};

/**
 * Record a processed photo and hand it to the profile in one batch.
 *
 * The asset row and `member_profiles.photo_asset_id` have to move together: an asset marked ready
 * that no profile points at is an orphan the sweeper will collect, and a profile pointing at an
 * asset that is not ready renders a broken image even though its attachment looks valid.
 * The composite foreign key on `(photo_asset_id, user_id)` means the second statement cannot
 * attach another member's asset even if a caller asked it to.
 *
 * The profile is updated first and the asset promoted second, which is not arbitrary. Both are
 * guarded on the asset still being pending, and a D1 batch runs its statements in order inside one
 * transaction — so promoting first would leave the profile's guard looking at a row this same batch
 * had already changed, and it would never match. In this order each statement reads the state the
 * batch began with. Without a guard on the profile update at all, asking to promote an asset that
 * was already retired would fail to promote it and still point the profile at it: a member's photo
 * replaced by one being deleted.
 *
 * `attached` is separate from `replacedAssetId` because `null` for the second means "there was no
 * previous photo", which is the ordinary first upload and not a failure. Collapsing the two into
 * one nullable return is how a refused promotion would read as a success.
 */
export const attachReadyProfilePhoto = async (
  db: Db,
  input: {
    userId: string;
    assetId: string;
    mimeType: ProfilePhotoMimeType;
    byteSize: number;
    width: number;
    height: number;
  },
): Promise<{ attached: boolean; replacedAssetId: string | null }> => {
  const now = new Date();
  const promotable = and(
    eq(profileAssets.id, input.assetId),
    eq(profileAssets.userId, input.userId),
    eq(profileAssets.status, 'pending'),
  );
  const previous = await db
    .select({ photoAssetId: memberProfiles.photoAssetId })
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, input.userId))
    .limit(1);
  const [, promoted] = await db.batch([
    db
      .update(memberProfiles)
      .set({ photoAssetId: input.assetId, updatedAt: now })
      .where(
        and(
          eq(memberProfiles.userId, input.userId),
          exists(
            db
              .select({ id: profileAssets.id })
              .from(profileAssets)
              .where(promotable),
          ),
        ),
      ),
    db
      .update(profileAssets)
      .set({
        status: 'ready',
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        width: input.width,
        height: input.height,
        revision: sql`${profileAssets.revision} + 1`,
        updatedAt: now,
      })
      .where(promotable)
      .returning({ id: profileAssets.id }),
  ]);
  if (promoted.length === 0) return { attached: false, replacedAssetId: null };
  const replaced = previous[0]?.photoAssetId ?? null;
  return {
    attached: true,
    replacedAssetId: replaced === input.assetId ? null : replaced,
  };
};

/**
 * Detach a photo and mark it for collection, without deleting anything yet.
 *
 * Removal has to be immediate from the member's point of view and unhurried from the bucket's: the
 * profile stops pointing at the asset in the same statement that stops it being published, while
 * the bytes wait for the sweeper. Deleting inline would put an R2 round trip — and its failure
 * modes — inside the request that has already told the member their photo is gone.
 */
export const retireProfilePhoto = async (
  db: Db,
  userId: string,
  assetId: string,
): Promise<boolean> => {
  const now = new Date();
  const [retired] = await db.batch([
    db
      .update(profileAssets)
      .set({ status: 'deleting', expiresAt: now, updatedAt: now })
      .where(
        and(
          eq(profileAssets.id, assetId),
          eq(profileAssets.userId, userId),
          ne(profileAssets.status, 'deleting'),
        ),
      )
      .returning({ id: profileAssets.id }),
    db
      .update(memberProfiles)
      .set({ photoAssetId: null, updatedAt: now })
      .where(
        and(
          eq(memberProfiles.userId, userId),
          eq(memberProfiles.photoAssetId, assetId),
        ),
      ),
  ]);
  return retired.length > 0;
};

/** Read an attached ready avatar for public delivery, excluding suppressed identities. */
export const getDeliverableProfilePhoto = async (db: Db, assetId: string) => {
  const rows = await db
    .select({
      objectKey: profileAssets.objectKey,
      revision: profileAssets.revision,
      userId: profileAssets.userId,
    })
    .from(profileAssets)
    .innerJoin(
      memberProfiles,
      and(
        eq(memberProfiles.photoAssetId, profileAssets.id),
        eq(memberProfiles.userId, profileAssets.userId),
      ),
    )
    .where(
      and(
        eq(profileAssets.id, assetId),
        eq(profileAssets.status, 'ready'),
        visibleIdentity(profileAssets.userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return row;
};

/** Assets whose reservation or retirement has come due, oldest first. */
export const listCollectableProfileAssets = async (
  db: Db,
  now: Date,
  limit = 50,
) =>
  db
    .select({
      id: profileAssets.id,
      objectKey: profileAssets.objectKey,
    })
    .from(profileAssets)
    .where(
      and(
        ne(profileAssets.status, 'ready'),
        lte(profileAssets.expiresAt, now),
        notExists(
          db
            .select({ userId: memberProfiles.userId })
            .from(memberProfiles)
            .where(eq(memberProfiles.photoAssetId, profileAssets.id)),
        ),
      ),
    )
    .orderBy(profileAssets.expiresAt)
    .limit(limit);

/** Forget a collected asset. Safe to repeat: the bytes are gone before the row is. */
export const deleteProfileAsset = async (
  db: Db,
  assetId: string,
): Promise<void> => {
  await db.delete(profileAssets).where(eq(profileAssets.id, assetId));
};
