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
      meetupChat: true,
      meetupChatChannels: ['push'],
      smsFallbackEnabled: false,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.preferences.eventUpdates).toBe(false);
      expect(result.data.preferences.eventUpdatesChannels).toEqual([]);
      expect(result.data.preferences.eventReminders).toBe(true);
      expect(result.data.preferences.eventRemindersChannels).toEqual(['email']);
      expect(result.data.preferences.meetupChat).toBe(true);
      expect(result.data.preferences.meetupChatChannels).toEqual(['push']);
    }
  });

  it('turns the meetup chat’s push off, and back on, as its own category', async () => {
    const { db, userId } = await setup();
    const before = await readMyPreferences(db, userId);
    expect(before.ok && before.data.preferences.meetupChatChannels).toEqual([
      'push',
    ]);
    const choices = {
      eventUpdates: true,
      eventUpdatesChannels: ['push', 'email'] as ('push' | 'email')[],
      eventReminders: true,
      eventRemindersChannels: ['push', 'email'] as ('push' | 'email')[],
      hostRsvpReceived: true,
      hostRsvpReceivedChannels: ['push', 'email'] as ('push' | 'email')[],
      hostRsvpCancelled: true,
      hostRsvpCancelledChannels: ['push', 'email'] as ('push' | 'email')[],
      followUpPrompts: true,
      followUpPromptsChannels: ['email'] as ('push' | 'email')[],
      smsFallbackEnabled: false,
    };

    const off = await saveMyPreferences(db, userId, {
      ...choices,
      meetupChat: false,
      meetupChatChannels: ['push'],
      expectedRevision: 0,
    });
    const on = await saveMyPreferences(db, userId, {
      ...choices,
      meetupChat: true,
      meetupChatChannels: ['push'],
      expectedRevision: 1,
    });

    expect(off.ok && off.data.preferences).toMatchObject({
      meetupChat: false,
      meetupChatChannels: [],
      eventUpdatesChannels: ['push', 'email'],
    });
    expect(on.ok && on.data.preferences).toMatchObject({
      meetupChat: true,
      meetupChatChannels: ['push'],
    });
  });
});
