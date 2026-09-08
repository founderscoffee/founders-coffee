import { and, eq, exists, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';
import { profileAssets, user } from './schema.js';

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
