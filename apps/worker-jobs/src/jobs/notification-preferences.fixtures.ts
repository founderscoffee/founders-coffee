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
    hostRsvpReceived?: boolean;
    hostRsvpReceivedChannels?: number;
    hostRsvpCancelled?: boolean;
    hostRsvpCancelledChannels?: number;
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
    hostRsvpReceived:
      changes.hostRsvpReceived ??
      (changes.hostRsvpReceivedChannels === undefined
        ? undefined
        : changes.hostRsvpReceivedChannels !== 0),
    hostRsvpReceivedChannels:
      changes.hostRsvpReceivedChannels ??
      (changes.hostRsvpReceived === undefined
        ? undefined
        : changes.hostRsvpReceived
          ? 5
          : 0),
    hostRsvpCancelled:
      changes.hostRsvpCancelled ??
      (changes.hostRsvpCancelledChannels === undefined
        ? undefined
        : changes.hostRsvpCancelledChannels !== 0),
    hostRsvpCancelledChannels:
      changes.hostRsvpCancelledChannels ??
      (changes.hostRsvpCancelled === undefined
        ? undefined
        : changes.hostRsvpCancelled
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
