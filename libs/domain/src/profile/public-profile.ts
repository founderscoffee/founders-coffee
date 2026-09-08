import { z } from 'zod';

import { idSchema, localeSchema } from '@founders-coffee/core';

import {
  COMMUNITY_ROLES,
  displayNameSchema,
  introductionSchema,
  PROFILE_INTERESTS,
  professionalLinkSchema,
  profileIdentitySchema,
  type OwnerProfile,
} from './schemas.js';

export const publicMemberProfileSchema = z.strictObject({
  userId: profileIdentitySchema,
  displayName: displayNameSchema,
  photoAssetId: idSchema.nullable(),
  introduction: introductionSchema,
  introductionLocale: localeSchema.nullable(),
  communityRole: z.enum(COMMUNITY_ROLES).nullable(),
  interests: z.array(z.enum(PROFILE_INTERESTS)).max(5),
  spokenLanguages: z.array(localeSchema).max(3),
  professionalLink: professionalLinkSchema,
});

export type PublicMemberProfile = z.infer<typeof publicMemberProfileSchema>;

/** Project only explicitly published profile data; authorization and asset delivery stay server-side. */
export const projectPublicProfile = (
  profile: OwnerProfile,
): PublicMemberProfile => ({
  userId: profile.userId,
  displayName: profile.displayName,
  photoAssetId: profile.visibility.photo ? profile.photoAssetId : null,
  introduction: profile.visibility.introduction ? profile.introduction : null,
  introductionLocale: profile.visibility.introduction
    ? profile.introductionLocale
    : null,
  communityRole: profile.visibility.communityRole
    ? profile.communityRole
    : null,
  interests: profile.visibility.interests ? [...profile.interests] : [],
  spokenLanguages: profile.visibility.spokenLanguages
    ? [...profile.spokenLanguages]
    : [],
  professionalLink: profile.visibility.professionalLink
    ? profile.professionalLink
    : null,
});
