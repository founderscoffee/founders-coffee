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
const record = { hosted: 6, attended: 11 };

describe('public profile projection', () => {
  it('publishes the uploaded avatar and introduction but never exposes private optional details, auth fields or ownership controls by default', () => {
    const projected = projectPublicProfile(
      {
        ...owner,
        email: 'private@example.com',
        role: 'admin',
      } as typeof owner,
      record,
    );
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
      hostedCount: 6,
      attendedCount: null,
    });
    expect(publicMemberProfileSchema.parse(projected)).toEqual(projected);
  });

  it('publishes each opted-in field through a fixed allowlist', () => {
    const projected = projectPublicProfile(
      {
        ...owner,
        visibility: {
          headline: true,
          stage: true,
          interests: true,
          spokenLanguages: true,
          professionalLink: true,
          attendedCount: true,
        },
      },
      record,
    );
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
      hostedCount: 6,
      attendedCount: 11,
    });
    expect(projected.interests).not.toBe(owner.interests);
    expect(projected.spokenLanguages).not.toBe(owner.spokenLanguages);
  });

  it('does not couple independent visibility choices', () => {
    const projected = projectPublicProfile(
      {
        ...owner,
        visibility: { ...owner.visibility, interests: true },
      },
      record,
    );
    expect(projected.headline).toBeNull();
    expect(projected.stage).toBeNull();
    expect(projected.attendedCount).toBeNull();
    expect(
      projectPublicProfile(
        {
          ...owner,
          visibility: { ...owner.visibility, stage: true },
        },
        record,
      ),
    ).toMatchObject({ headline: null, stage: 'building' });
    expect(
      projectPublicProfile(
        {
          ...owner,
          visibility: { ...owner.visibility, attendedCount: true },
        },
        record,
      ),
    ).toMatchObject({ interests: [], attendedCount: 11 });
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

  it('publishes the hosted count whatever the member chose, and never a negative or fractional one', () => {
    const hidden = projectPublicProfile(owner, record);

    expect(hidden.hostedCount).toBe(6);
    for (const hostedCount of [-1, 1.5]) {
      expect(
        publicMemberProfileSchema.safeParse({ ...hidden, hostedCount }).success,
      ).toBe(false);
    }
  });
});
