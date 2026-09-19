import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { createDb, seed, user } from '@founders-coffee/db';

import { readMyPreferences, saveMyPreferences } from './preferences.js';

const setup = async () => {
  const db = createDb(env.DB);
  await seed(db);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Channel Owner',
    email: `${userId}@test.coffee`,
    emailVerified: true,
  });
  return { db, userId };
};

describe('per-category notification channels', () => {
  it('persists a selected channel set and aligns its category gate', async () => {
    const { db, userId } = await setup();
    await readMyPreferences(db, userId);

    const result = await saveMyPreferences(db, userId, {
      eventUpdates: false,
      eventUpdatesChannels: [],
      eventReminders: true,
      eventRemindersChannels: ['email'],
      hostRsvpReceived: true,
      hostRsvpReceivedChannels: ['push', 'email'],
      hostRsvpCancelled: true,
      hostRsvpCancelledChannels: ['push', 'email'],
      followUpPrompts: false,
      followUpPromptsChannels: [],
      smsFallbackEnabled: false,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preferences.eventUpdates).toBe(false);
      expect(result.data.preferences.eventUpdatesChannels).toEqual([]);
      expect(result.data.preferences.eventReminders).toBe(true);
      expect(result.data.preferences.eventRemindersChannels).toEqual(['email']);
    }
  });
});
