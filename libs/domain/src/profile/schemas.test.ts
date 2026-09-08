import { describe, expect, it } from 'vitest';

import {
  displayNameSchema,
  introductionSchema,
  ownerProfileSchema,
  professionalLinkSchema,
  profileIdentitySchema,
  profileRevisionSchema,
  updateProfileSchema,
} from './schemas.js';

const minimal = { displayName: '  أمينة  ', expectedRevision: 0 };

describe('profile contracts', () => {
  it('defaults optional data to absent and private, without collecting location', () => {
    expect(updateProfileSchema.parse(minimal)).toEqual({
      displayName: 'أمينة',
      expectedRevision: 0,
      introduction: null,
      introductionLocale: null,
      communityRole: null,
      interests: [],
      spokenLanguages: [],
      professionalLink: null,
      visibility: {
        photo: false,
        introduction: false,
        communityRole: false,
        interests: false,
        spokenLanguages: false,
        professionalLink: false,
      },
    });
  });

  it.each([
    'email',
    'phoneNumber',
    'role',
    'homeCityId',
    'homeMarketCode',
    'homeState',
    'userId',
    'photoAssetId',
    'revision',
    'banned',
  ])('rejects mass assignment of %s', (field) => {
    expect(
      updateProfileSchema.safeParse({ ...minimal, [field]: 'forbidden' })
        .success,
    ).toBe(false);
  });

  it('rejects unknown nested visibility fields and invalid field values', () => {
    for (const changes of [
      { visibility: { email: true } },
      { communityRole: 'admin' },
      { interests: ['product', 'product'] },
      { interests: ['unknown'] },
      {
        interests: [
          'bootstrapping',
          'product',
          'design',
          'engineering',
          'finding_customers',
          'community',
        ],
      },
      { spokenLanguages: ['en', 'en'] },
      { spokenLanguages: ['es'] },
      { introductionLocale: 'es' },
    ])
      expect(
        updateProfileSchema.safeParse({ ...minimal, ...changes }).success,
      ).toBe(false);
  });

  it('requires the authored language only for a nonempty introduction', () => {
    const invalid = updateProfileSchema.safeParse({
      ...minimal,
      introduction: 'Bonjour',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success)
      expect(invalid.error.issues[0]?.path).toEqual(['introductionLocale']);
    expect(
      updateProfileSchema.parse({
        ...minimal,
        introduction: ' ',
        introductionLocale: 'fr',
      }).introductionLocale,
    ).toBeNull();
    expect(
      updateProfileSchema.parse({
        ...minimal,
        introduction: 'Bonjour',
        introductionLocale: 'fr',
      }).introductionLocale,
    ).toBe('fr');
  });

  it('clears publication flags for emptied fields but retains populated opt-ins', () => {
    const visibility = {
      photo: true,
      introduction: true,
      communityRole: true,
      interests: true,
      spokenLanguages: true,
      professionalLink: true,
    };
    expect(
      updateProfileSchema.parse({ ...minimal, visibility }).visibility,
    ).toEqual({
      ...visibility,
      introduction: false,
      communityRole: false,
      interests: false,
      spokenLanguages: false,
      professionalLink: false,
    });
    const value = updateProfileSchema.parse({
      ...minimal,
      visibility,
      introduction: 'Hello',
      introductionLocale: 'en',
      communityRole: 'founder',
      interests: ['product'],
      spokenLanguages: ['ar', 'fr', 'en'],
      professionalLink: 'https://example.com/member',
    });
    expect(value.visibility).toEqual(visibility);
  });

  it('supports Unicode names and descriptions with bounded code point counts', () => {
    expect(displayNameSchema.parse('🙂'.repeat(80))).toHaveLength(160);
    expect(displayNameSchema.safeParse('a'.repeat(81)).success).toBe(false);
    expect(displayNameSchema.safeParse('   ').success).toBe(false);
    expect(introductionSchema.parse('🙂'.repeat(300))).toHaveLength(600);
    expect(introductionSchema.safeParse('a'.repeat(301)).success).toBe(false);
    expect(introductionSchema.parse(null)).toBeNull();
    expect(introductionSchema.parse('  ')).toBeNull();
  });

  it('accepts opaque Better Auth identity IDs but bounds revisions', () => {
    expect(profileIdentitySchema.parse('auth-user')).toBe('auth-user');
    expect(profileIdentitySchema.safeParse(' ').success).toBe(false);
    expect(profileIdentitySchema.safeParse('a'.repeat(129)).success).toBe(
      false,
    );
    for (const revision of [-1, 0.5, Number.MAX_SAFE_INTEGER, Infinity]) {
      expect(profileRevisionSchema.safeParse(revision).success).toBe(false);
    }
    expect(profileRevisionSchema.parse(1)).toBe(1);
  });

  it('validates the owner response independently of update input', () => {
    const value = ownerProfileSchema.parse({
      userId: 'opaque-auth-id',
      displayName: 'Amina',
      revision: 0,
      photoAssetId: null,
    });
    expect(value.visibility.photo).toBe(false);
    expect(
      ownerProfileSchema.safeParse({
        ...value,
        photoAssetId: 'https://remote.test/image',
      }).success,
    ).toBe(false);
  });
});

describe('professional links', () => {
  it.each(['https://example.com/member', 'https://مثال.إختبار/'])(
    'accepts %s',
    (url) => {
      expect(professionalLinkSchema.parse(url)).toBe(url);
    },
  );
  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'data:text/html,test',
    'not a url',
    'https://user@example.com',
    'https://:password@example.com',
    'https://example.com/' + 'a'.repeat(2048),
  ])('rejects unsafe or invalid URL %s', (url) => {
    expect(professionalLinkSchema.safeParse(url).success).toBe(false);
  });
  it('normalizes empty values', () => {
    expect(professionalLinkSchema.parse('   ')).toBeNull();
    expect(professionalLinkSchema.parse(null)).toBeNull();
  });
});
