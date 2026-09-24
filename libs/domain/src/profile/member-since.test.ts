import { describe, expect, it } from 'vitest';

import {
  projectPublicProfile,
  publicMemberProfileSchema,
} from './public-profile.js';
import {
  memberSinceOf,
  memberSinceSchema,
  ownerProfileSchema,
} from './schemas.js';

describe('member since (#89)', () => {
  it('keeps only the month an account was created, in UTC', () => {
    expect(memberSinceOf(new Date('2026-03-31T23:30:00Z'))).toBe('2026-03');
    expect(memberSinceOf(new Date('2026-04-01T00:00:00Z'))).toBe('2026-04');
    expect(memberSinceOf(new Date('2025-12-15T12:00:00Z'))).toBe('2025-12');
  });

  it.each(['2026-03', '2025-12', '2026-01'])('accepts %s', (value) => {
    expect(memberSinceSchema.parse(value)).toBe(value);
  });

  it.each(['2026-3', '2026-00', '2026-13', '2026-03-31', '26-03', ''])(
    'refuses %j, which is not a year and a month',
    (value) => {
      expect(memberSinceSchema.safeParse(value).success).toBe(false);
    },
  );

  it('is published whatever the member chose to show, because it is not theirs to hide', () => {
    const owner = ownerProfileSchema.parse({
      userId: 'opaque-auth-id',
      displayName: 'Amina',
      revision: 0,
      photoAssetId: null,
      memberSince: '2026-03',
    });

    const published = projectPublicProfile(owner);

    expect(published.memberSince).toBe('2026-03');
    expect(publicMemberProfileSchema.parse(published)).toEqual(published);
    expect(
      publicMemberProfileSchema.safeParse({
        ...published,
        memberSince: '2026-03-14',
      }).success,
    ).toBe(false);
  });
});
