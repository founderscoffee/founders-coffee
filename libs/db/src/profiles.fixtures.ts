import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';

import { createDb } from './db.js';
import {
  initializeMemberProfile,
  type MemberProfileChanges,
} from './member-profiles.js';
import type { AccountPreferenceChanges } from './account-preferences.js';
import { user, type NewUser } from './schema.js';

export const profileChanges: MemberProfileChanges = {
  headline: null,
  stage: null,
  introduction: 'Community first',
  interests: ['community'],
  spokenLanguages: ['ar', 'en'],
  professionalLink: 'https://example.com',
  publishHeadline: false,
  publishStage: false,
  publishAttendedCount: false,
  publishInterests: false,
  publishSpokenLanguages: false,
  publishProfessionalLink: false,
};

export const preferenceChanges: AccountPreferenceChanges = {
  eventUpdates: true,
  eventUpdatesChannels: 5,
  eventReminders: true,
  eventRemindersChannels: 5,
  hostRsvpReceived: true,
  hostRsvpReceivedChannels: 5,
  hostRsvpCancelled: true,
  hostRsvpCancelledChannels: 5,
  followUpPrompts: false,
  followUpPromptsChannels: 0,
  pushEnabled: false,
  smsFallbackEnabled: false,
};

export const profileFixture = async (overrides: Partial<NewUser> = {}) => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Original',
    email: `${userId}@test.coffee`,
    ...overrides,
  });
  await initializeMemberProfile(db, userId);
  return { db, userId };
};
