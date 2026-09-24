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
  memberSince: '2025-11',
  headline: 'Founder, a bookkeeping app for small shops',
  stage: 'building',
  introduction: 'Building a community',
  interests: ['community'],
  spokenLanguages: ['ar', 'fr'],
  professionalLink: 'https://example.com/amina',
});

describe('public profile projection', () => {
  it('publishes the uploaded avatar and introduction but never exposes private optional details, auth fields or ownership controls by default', () => {
    const projected = projectPublicProfile({
      ...owner,
      email: 'private@example.com',
      role: 'admin',
    } as typeof owner);
    expect(projected).toEqual({
      userId: owner.userId,
      displayName: 'Amina',
      photoAssetId: owner.photoAssetId,
      memberSince: '2025-11',
      headline: null,
      stage: null,
      introduction: owner.introduction,
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
        headline: true,
        stage: true,
        interests: true,
        spokenLanguages: true,
        professionalLink: true,
      },
    });
    expect(projected).toEqual({
      userId: owner.userId,
      displayName: owner.displayName,
      photoAssetId: owner.photoAssetId,
      memberSince: '2025-11',
      headline: 'Founder, a bookkeeping app for small shops',
      stage: 'building',
      introduction: owner.introduction,
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
      visibility: { ...owner.visibility, interests: true },
    });
    expect(projected.headline).toBeNull();
    expect(projected.stage).toBeNull();
    expect(
      projectPublicProfile({
        ...owner,
        visibility: { ...owner.visibility, stage: true },
      }),
    ).toMatchObject({ headline: null, stage: 'building' });
    expect(projected.introduction).toBe(owner.introduction);
    expect(projected.interests).toEqual(owner.interests);
    expect(projected.photoAssetId).toBe(owner.photoAssetId);
    expect(
      publicMemberProfileSchema.safeParse({
        ...projected,
        email: 'private@example.com',
      }).success,
    ).toBe(false);
  });
});
