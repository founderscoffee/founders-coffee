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
  introduction: 'Community first',
  introductionLocale: 'en',
  communityRole: 'founder',
  interests: ['community'],
  spokenLanguages: ['ar', 'en'],
  professionalLink: 'https://example.com',
  publishPhoto: false,
  publishIntroduction: true,
  publishCommunityRole: false,
  publishInterests: false,
  publishSpokenLanguages: false,
  publishProfessionalLink: false,
};

export const preferenceChanges: AccountPreferenceChanges = {
  eventUpdates: true,
  eventReminders: true,
  hostUpdates: true,
  followUpPrompts: false,
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
