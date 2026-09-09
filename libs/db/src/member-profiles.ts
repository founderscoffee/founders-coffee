import { and, eq, exists, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';
import {
  accountPreferences,
  memberProfiles,
  user,
  type MemberProfileRow,
} from './schema.js';

export type MemberProfileChanges = Pick<
  MemberProfileRow,
  | 'introduction'
  | 'interests'
  | 'spokenLanguages'
  | 'professionalLink'
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

/**
 * Whether a public read may attribute a row to this member.
 *
 * The feed and the hosted history answer this in SQL, correlated to the row they are already
 * reading. A single event fetched by slug has no such join to hang it on, so it asks the same
 * question here rather than growing a second definition of who is visible.
 */
export const isVisibleIdentity = async (
  db: Db,
  userId: string,
): Promise<boolean> => {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(activeProfileIdentity(userId))
    .limit(1);
  return rows.length > 0;
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
  const matches = and(
    eq(memberProfiles.userId, userId),
    eq(memberProfiles.revision, expectedRevision),
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
        interests: changes.interests,
        spokenLanguages: changes.spokenLanguages,
        professionalLink: changes.professionalLink,
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
