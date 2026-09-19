import { and, eq, exists, isNotNull, ne, sql } from 'drizzle-orm';

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
  | 'hostRsvpReceived'
  | 'hostRsvpReceivedChannels'
  | 'hostRsvpCancelled'
  | 'hostRsvpCancelledChannels'
  | 'followUpPrompts'
  | 'followUpPromptsChannels'
  | 'pushEnabled'
  | 'smsFallbackEnabled'
>;

/**
 * Read notification preferences and the phone state needed to explain the SMS fallback control.
 *
 * The phone's verified state travels with them because the SMS fallback switch is not the member's
 * to set alone: {@link updateAccountPreferences} refuses consent without a currently verified
 * number, and a screen that cannot see that would render a switch whose save silently fails. What
 * the writer requires, the reader has to be able to explain.
 */
export const getAccountPreferences = async (db: Db, userId: string) => {
  const rows = await db
    .select({
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

/** Atomically persist notification preferences and server-owned SMS consent evidence. */
export const updateAccountPreferences = async (
  db: Db,
  input: {
    userId: string;
    expectedRevision: number;
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
  const [rows] = await db.batch([
    db
      .update(accountPreferences)
      .set({
        eventUpdates: changes.eventUpdatesChannels !== 0,
        eventUpdatesChannels: changes.eventUpdatesChannels,
        eventReminders: changes.eventRemindersChannels !== 0,
        eventRemindersChannels: changes.eventRemindersChannels,
        hostRsvpReceived: changes.hostRsvpReceivedChannels !== 0,
        hostRsvpReceivedChannels: changes.hostRsvpReceivedChannels,
        hostRsvpCancelled: changes.hostRsvpCancelledChannels !== 0,
        hostRsvpCancelledChannels: changes.hostRsvpCancelledChannels,
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
