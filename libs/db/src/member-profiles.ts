import { and, eq, exists, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';
import {
  accountPreferences,
  memberProfiles,
  profileAssets,
  user,
  type MemberProfileRow,
} from './schema.js';

export type MemberProfileChanges = Pick<
  MemberProfileRow,
  | 'introduction'
  | 'introductionLocale'
  | 'communityRole'
  | 'interests'
  | 'spokenLanguages'
  | 'professionalLink'
  | 'publishPhoto'
  | 'publishIntroduction'
  | 'publishCommunityRole'
  | 'publishInterests'
  | 'publishSpokenLanguages'
  | 'publishProfessionalLink'
>;

/** Read only the identity fields needed to suppress contact fallbacks; never expose this row over RPC. */
export const getProfileIdentity = async (db: Db, userId: string) => {
  const rows = await db
    .select({
      name: user.name,
      email: user.email,
    })
    .from(user)
    .where(activeProfileIdentity(userId))
    .limit(1);
  return rows[0] ?? null;
};

/** Initialize location-free defaults once, including under simultaneous first writes. */
export const initializeMemberProfile = async (
  db: Db,
  userId: string,
): Promise<void> => {
  await Promise.all([
    db.run(sql`INSERT INTO ${memberProfiles} (user_id)
      SELECT ${user.id} FROM ${user} WHERE ${activeProfileIdentity(userId)}
      ON CONFLICT (user_id) DO NOTHING`),
    db.run(sql`INSERT INTO ${accountPreferences} (user_id)
      SELECT ${user.id} FROM ${user} WHERE ${activeProfileIdentity(userId)}
      ON CONFLICT (user_id) DO NOTHING`),
  ]);
};

/** Read the profile without ever selecting contact, ban reasons or credential fields. */
export const getMemberProfile = async (db: Db, userId: string) => {
  const rows = await db
    .select({
      displayName: user.name,
      locale: user.localePref,
      profile: memberProfiles,
    })
    .from(memberProfiles)
    .innerJoin(user, eq(user.id, memberProfiles.userId))
    .where(activeProfileIdentity(userId))
    .limit(1);
  return rows[0] ?? null;
};

/**
 * Report why a conditional profile write can have failed, without re-running it.
 *
 * `updateMemberProfile` answers a failure with `null` because its predicate is a single SQL
 * expression, and three different situations produce that one answer: the revision moved under the
 * caller, the account stopped being active, or publication of a photo was asked for with no ready
 * asset behind it. Telling a member "reload before saving" when the real problem is that they have
 * no photo yet sends them round a loop that reloading cannot break, so the caller reads this
 * afterwards to say which one it was. Only the failure path pays for it.
 */
export const readProfileWriteState = async (
  db: Db,
  userId: string,
): Promise<{ revision: number; hasReadyPhoto: boolean } | null> => {
  const rows = await db
    .select({
      revision: memberProfiles.revision,
      photoStatus: profileAssets.status,
    })
    .from(memberProfiles)
    .innerJoin(user, eq(user.id, memberProfiles.userId))
    .leftJoin(
      profileAssets,
      and(
        eq(profileAssets.id, memberProfiles.photoAssetId),
        eq(profileAssets.userId, memberProfiles.userId),
      ),
    )
    .where(activeProfileIdentity(userId))
    .limit(1);
  const row = rows[0];
  return row
    ? { revision: row.revision, hasReadyPhoto: row.photoStatus === 'ready' }
    : null;
};

/** Atomically change the auth display name and profile under one optimistic revision. */
export const updateMemberProfile = async (
  db: Db,
  input: {
    userId: string;
    displayName: string;
    expectedRevision: number;
    changes: MemberProfileChanges;
  },
): Promise<MemberProfileRow | null> => {
  const { userId, expectedRevision, changes } = input;
  const eligiblePhoto = changes.publishPhoto
    ? exists(
        db
          .select({ id: profileAssets.id })
          .from(profileAssets)
          .where(
            and(
              eq(profileAssets.id, memberProfiles.photoAssetId),
              eq(profileAssets.userId, userId),
              eq(profileAssets.status, 'ready'),
            ),
          ),
      )
    : sql`1`;
  const matches = and(
    eq(memberProfiles.userId, userId),
    eq(memberProfiles.revision, expectedRevision),
    eligiblePhoto,
  );
  const liveUser = exists(
    db.select({ id: user.id }).from(user).where(activeProfileIdentity(userId)),
  );
  const now = new Date();
  const [, rows] = await db.batch([
    db
      .update(user)
      .set({ name: input.displayName, updatedAt: now })
      .where(
        and(
          activeProfileIdentity(userId),
          exists(
            db
              .select({ id: memberProfiles.userId })
              .from(memberProfiles)
              .where(matches),
          ),
        ),
      ),
    db
      .update(memberProfiles)
      .set({
        introduction: changes.introduction,
        introductionLocale: changes.introductionLocale,
        communityRole: changes.communityRole,
        interests: changes.interests,
        spokenLanguages: changes.spokenLanguages,
        professionalLink: changes.professionalLink,
        publishPhoto: changes.publishPhoto,
        publishIntroduction: changes.publishIntroduction,
        publishCommunityRole: changes.publishCommunityRole,
        publishInterests: changes.publishInterests,
        publishSpokenLanguages: changes.publishSpokenLanguages,
        publishProfessionalLink: changes.publishProfessionalLink,
        revision: sql`${memberProfiles.revision} + 1`,
        updatedAt: now,
      })
      .where(and(matches, liveUser))
      .returning(),
  ]);
  return rows[0] ?? null;
};
