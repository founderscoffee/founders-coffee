import { z } from 'zod';

import { idSchema, localeSchema } from '@founders-coffee/core';

export const COMMUNITY_ROLES = [
  'founder',
  'aspiring_founder',
  'developer',
  'designer',
  'community_builder',
  'other',
] as const;
export const PROFILE_INTERESTS = [
  'bootstrapping',
  'product',
  'design',
  'engineering',
  'finding_customers',
  'community',
] as const;

export const profileIdentitySchema = z.string().trim().min(1).max(128);
export const profileRevisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((value) => Array.from(value).length <= 80, 'Name is too long');
export const introductionSchema = z
  .string()
  .trim()
  .max(600)
  .refine(
    (value) => Array.from(value).length <= 300,
    'Introduction is too long',
  )
  .nullable()
  .transform((value) => value || null);
export const professionalLinkSchema = z
  .string()
  .trim()
  .max(2048)
  .nullable()
  .transform((value) => value || null)
  .refine((value) => {
    if (value === null) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'A credential-free HTTPS URL is required');

export const profileVisibilitySchema = z.strictObject({
  photo: z.boolean().default(false),
  introduction: z.boolean().default(false),
  communityRole: z.boolean().default(false),
  interests: z.boolean().default(false),
  spokenLanguages: z.boolean().default(false),
  professionalLink: z.boolean().default(false),
});

export const profileDetailsSchema = z.strictObject({
  introduction: introductionSchema.default(null),
  introductionLocale: localeSchema.nullable().default(null),
  communityRole: z.enum(COMMUNITY_ROLES).nullable().default(null),
  interests: z
    .array(z.enum(PROFILE_INTERESTS))
    .max(5)
    .refine(
      (values) => new Set(values).size === values.length,
      'Interests must be unique',
    )
    .default([]),
  spokenLanguages: z
    .array(localeSchema)
    .max(3)
    .refine(
      (values) => new Set(values).size === values.length,
      'Languages must be unique',
    )
    .default([]),
  professionalLink: professionalLinkSchema.default(null),
  visibility: profileVisibilitySchema.default(() =>
    profileVisibilitySchema.parse({}),
  ),
});

const validateAuthoredLanguage = (
  details: z.infer<typeof profileDetailsSchema>,
  context: z.RefinementCtx,
) => {
  if (details.introduction !== null && details.introductionLocale === null) {
    context.addIssue({
      code: 'custom',
      path: ['introductionLocale'],
      message: 'Authored language is required',
    });
  }
};

const normalizeProfile = <T extends z.infer<typeof profileDetailsSchema>>(
  details: T,
): T => ({
  ...details,
  introductionLocale:
    details.introduction === null ? null : details.introductionLocale,
  visibility: {
    ...details.visibility,
    introduction:
      details.visibility.introduction && details.introduction !== null,
    communityRole:
      details.visibility.communityRole && details.communityRole !== null,
    interests: details.visibility.interests && details.interests.length > 0,
    spokenLanguages:
      details.visibility.spokenLanguages && details.spokenLanguages.length > 0,
    professionalLink:
      details.visibility.professionalLink && details.professionalLink !== null,
  },
});

export const updateProfileSchema = profileDetailsSchema
  .extend({
    displayName: displayNameSchema,
    expectedRevision: profileRevisionSchema,
  })
  .superRefine(validateAuthoredLanguage)
  .transform(normalizeProfile);

export const ownerProfileSchema = profileDetailsSchema
  .extend({
    userId: profileIdentitySchema,
    displayName: z.union([displayNameSchema, z.literal('')]),
    photoAssetId: idSchema.nullable(),
    revision: profileRevisionSchema,
  })
  .superRefine(validateAuthoredLanguage)
  .transform(normalizeProfile);

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
