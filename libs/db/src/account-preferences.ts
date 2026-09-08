import { and, eq, exists, isNotNull, ne, sql } from 'drizzle-orm';

import type { Locale } from '@founders-coffee/core';

import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';
import {
  accountPreferences,
  user,
  type AccountPreferencesRow,
} from './schema.js';

export type AccountPreferenceChanges = Pick<
  AccountPreferencesRow,
  | 'eventUpdates'
  | 'eventReminders'
  | 'hostUpdates'
  | 'followUpPrompts'
  | 'pushEnabled'
  | 'smsFallbackEnabled'
>;

/** Read preferences with the existing identity locale as its sole persisted source. */
export const getAccountPreferences = async (db: Db, userId: string) => {
  const rows = await db
    .select({ locale: user.localePref, preferences: accountPreferences })
    .from(accountPreferences)
    .innerJoin(user, eq(user.id, accountPreferences.userId))
    .where(activeProfileIdentity(userId))
    .limit(1);
  return rows[0] ?? null;
};

/** Atomically persist preferences, locale and server-owned SMS consent evidence. */
export const updateAccountPreferences = async (
  db: Db,
  input: {
    userId: string;
    expectedRevision: number;
    locale: Locale | null;
    changes: AccountPreferenceChanges;
  },
): Promise<AccountPreferencesRow | null> => {
  const { userId, changes, expectedRevision } = input;
  const eligibleUser = and(
    activeProfileIdentity(userId),
    changes.smsFallbackEnabled
      ? and(
          eq(user.phoneNumberVerified, true),
          isNotNull(user.phoneNumber),
          ne(user.phoneNumber, ''),
        )
      : sql`1`,
  );
  const matches = and(
    eq(accountPreferences.userId, userId),
    eq(accountPreferences.revision, expectedRevision),
  );
  const now = new Date();
  const [, rows] = await db.batch([
    db
      .update(user)
      .set({ localePref: input.locale, updatedAt: now })
      .where(
        and(
          eligibleUser,
          exists(
            db
              .select({ id: accountPreferences.userId })
              .from(accountPreferences)
              .where(matches),
          ),
        ),
      ),
    db
      .update(accountPreferences)
      .set({
        eventUpdates: changes.eventUpdates,
        eventReminders: changes.eventReminders,
        hostUpdates: changes.hostUpdates,
        followUpPrompts: changes.followUpPrompts,
        pushEnabled: changes.pushEnabled,
        smsFallbackEnabled: changes.smsFallbackEnabled,
        smsConsentAt: changes.smsFallbackEnabled
          ? sql`coalesce(${accountPreferences.smsConsentAt}, unixepoch())`
          : null,
        revision: sql`${accountPreferences.revision} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          matches,
          exists(db.select({ id: user.id }).from(user).where(eligibleUser)),
        ),
      )
      .returning(),
  ]);
  return rows[0] ?? null;
};
