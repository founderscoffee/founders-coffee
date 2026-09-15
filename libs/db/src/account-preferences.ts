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
  | 'eventUpdatesChannels'
  | 'eventReminders'
  | 'eventRemindersChannels'
  | 'hostUpdates'
  | 'hostUpdatesChannels'
  | 'followUpPrompts'
  | 'followUpPromptsChannels'
  | 'pushEnabled'
  | 'smsFallbackEnabled'
>;

/**
 * Read preferences with the existing identity locale as its sole persisted source.
 *
 * The phone's verified state travels with them because the SMS fallback switch is not the member's
 * to set alone: {@link updateAccountPreferences} refuses consent without a currently verified
 * number, and a screen that cannot see that would render a switch whose save silently fails. What
 * the writer requires, the reader has to be able to explain.
 */
export const getAccountPreferences = async (db: Db, userId: string) => {
  const rows = await db
    .select({
      locale: user.localePref,
      phoneVerified: sql<number>`(${user.phoneNumberVerified} = 1
        and ${user.phoneNumber} is not null and ${user.phoneNumber} != '')`,
      preferences: accountPreferences,
    })
    .from(accountPreferences)
    .innerJoin(user, eq(user.id, accountPreferences.userId))
    .where(activeProfileIdentity(userId))
    .limit(1);
  const row = rows[0];
  return row ? { ...row, phoneVerified: row.phoneVerified === 1 } : null;
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
        eventUpdates: changes.eventUpdatesChannels !== 0,
        eventUpdatesChannels: changes.eventUpdatesChannels,
        eventReminders: changes.eventRemindersChannels !== 0,
        eventRemindersChannels: changes.eventRemindersChannels,
        hostUpdates: changes.hostUpdatesChannels !== 0,
        hostUpdatesChannels: changes.hostUpdatesChannels,
        followUpPrompts: changes.followUpPromptsChannels !== 0,
        followUpPromptsChannels: changes.followUpPromptsChannels,
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
