import { z } from 'zod';

import { idSchema } from '@founders-coffee/core';

export const SPOKEN_LANGUAGES = ['ar', 'fr', 'en', 'es', 'de', 'ber'] as const;
export const spokenLanguageSchema = z.enum(SPOKEN_LANGUAGES);
export const PROFILE_INTERESTS = [
  'bootstrapping',
  'product',
  'design',
  'engineering',
  'finding_customers',
  'community',
  'investing',
  'software_development',
  'building_products',
  'idea_validation',
  'cofounders',
  'partnerships',
  'experience_sharing',
  'learning_new_skills',
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
  interests: z.boolean().default(false),
  spokenLanguages: z.boolean().default(false),
  professionalLink: z.boolean().default(false),
});

export const profileDetailsSchema = z.strictObject({
  introduction: introductionSchema.default(null),
  interests: z
    .array(z.enum(PROFILE_INTERESTS))
    .max(5)
    .refine(
      (values) => new Set(values).size === values.length,
      'Interests must be unique',
    )
    .default([]),
  spokenLanguages: z
    .array(spokenLanguageSchema)
    .max(6)
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

const normalizeProfile = <T extends z.infer<typeof profileDetailsSchema>>(
  details: T,
): T => ({
  ...details,
  visibility: {
    ...details.visibility,
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
  .transform(normalizeProfile);

export const ownerProfileSchema = profileDetailsSchema
  .extend({
    userId: profileIdentitySchema,
    displayName: z.union([displayNameSchema, z.literal('')]),
    photoAssetId: idSchema.nullable(),
    revision: profileRevisionSchema,
  })
  .transform(normalizeProfile);

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
