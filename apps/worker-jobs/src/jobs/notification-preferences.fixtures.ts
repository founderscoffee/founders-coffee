import { sql } from 'drizzle-orm';

import { accountPreferences, type Db } from '@founders-coffee/db';

export const MEMBER_ID = 'usr_sweepmember';

export const setPreferences = async (
  db: Db,
  changes: {
    eventUpdates?: boolean;
    eventUpdatesChannels?: number;
    eventReminders?: boolean;
    eventRemindersChannels?: number;
    hostUpdates?: boolean;
    hostUpdatesChannels?: number;
    followUpPrompts?: boolean;
    followUpPromptsChannels?: number;
    pushEnabled?: boolean;
    smsFallbackEnabled?: boolean;
  },
): Promise<void> => {
  const updates = {
    ...changes,
    eventUpdates:
      changes.eventUpdates ??
      (changes.eventUpdatesChannels === undefined
        ? undefined
        : changes.eventUpdatesChannels !== 0),
    eventUpdatesChannels:
      changes.eventUpdatesChannels ??
      (changes.eventUpdates === undefined
        ? undefined
        : changes.eventUpdates
          ? 5
          : 0),
    eventReminders:
      changes.eventReminders ??
      (changes.eventRemindersChannels === undefined
        ? undefined
        : changes.eventRemindersChannels !== 0),
    eventRemindersChannels:
      changes.eventRemindersChannels ??
      (changes.eventReminders === undefined
        ? undefined
        : changes.eventReminders
          ? 5
          : 0),
    hostUpdates:
      changes.hostUpdates ??
      (changes.hostUpdatesChannels === undefined
        ? undefined
        : changes.hostUpdatesChannels !== 0),
    hostUpdatesChannels:
      changes.hostUpdatesChannels ??
      (changes.hostUpdates === undefined
        ? undefined
        : changes.hostUpdates
          ? 5
          : 0),
    followUpPrompts:
      changes.followUpPrompts ??
      (changes.followUpPromptsChannels === undefined
        ? undefined
        : changes.followUpPromptsChannels !== 0),
    followUpPromptsChannels:
      changes.followUpPromptsChannels ??
      (changes.followUpPrompts === undefined
        ? undefined
        : changes.followUpPrompts
          ? 5
          : 0),
  };
  await db
    .insert(accountPreferences)
    .values({ userId: MEMBER_ID, ...updates })
    .onConflictDoUpdate({
      target: accountPreferences.userId,
      set: { ...updates, updatedAt: sql`(unixepoch())` },
    });
};
