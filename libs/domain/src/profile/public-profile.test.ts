import { describe, expect, it } from 'vitest';

import {
  projectPublicProfile,
  publicMemberProfileSchema,
} from './public-profile.js';
import { ownerProfileSchema } from './schemas.js';

const owner = ownerProfileSchema.parse({
  userId: 'opaque-auth-id',
  displayName: 'Amina',
  revision: 2,
  photoAssetId: `pha_${'1'.repeat(32)}`,
  introduction: 'Building a community',
  introductionLocale: 'en',
  communityRole: 'founder',
  interests: ['community'],
  spokenLanguages: ['ar', 'fr'],
  professionalLink: 'https://example.com/amina',
});

describe('public profile projection', () => {
  it('never exposes optional data, auth fields or ownership controls by default', () => {
    const projected = projectPublicProfile({
      ...owner,
      email: 'private@example.com',
      role: 'admin',
    } as typeof owner);
    expect(projected).toEqual({
      userId: owner.userId,
      displayName: 'Amina',
      photoAssetId: null,
      introduction: null,
      introductionLocale: null,
      communityRole: null,
      interests: [],
      spokenLanguages: [],
      professionalLink: null,
    });
    expect(publicMemberProfileSchema.parse(projected)).toEqual(projected);
  });

  it('publishes each opted-in field through a fixed allowlist', () => {
    const projected = projectPublicProfile({
      ...owner,
      visibility: {
        photo: true,
        introduction: true,
        communityRole: true,
        interests: true,
        spokenLanguages: true,
        professionalLink: true,
      },
    });
    expect(projected).toEqual({
      userId: owner.userId,
      displayName: owner.displayName,
      photoAssetId: owner.photoAssetId,
      introduction: owner.introduction,
      introductionLocale: 'en',
      communityRole: 'founder',
      interests: ['community'],
      spokenLanguages: ['ar', 'fr'],
      professionalLink: owner.professionalLink,
    });
    expect(projected.interests).not.toBe(owner.interests);
    expect(projected.spokenLanguages).not.toBe(owner.spokenLanguages);
  });

  it('does not couple independent visibility choices', () => {
    const projected = projectPublicProfile({
      ...owner,
      visibility: { ...owner.visibility, introduction: true },
    });
    expect(projected.introduction).toBe(owner.introduction);
    expect(projected.communityRole).toBeNull();
    expect(projected.photoAssetId).toBeNull();
    expect(
      publicMemberProfileSchema.safeParse({
        ...projected,
        email: 'private@example.com',
      }).success,
    ).toBe(false);
  });
});
