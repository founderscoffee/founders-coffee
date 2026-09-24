import { z } from 'zod';

import { idSchema } from '@founders-coffee/core';

import {
  spokenLanguageSchema,
  displayNameSchema,
  headlineSchema,
  introductionSchema,
  memberSinceSchema,
  profileInterestSchema,
  professionalLinkSchema,
  profileIdentitySchema,
  profileStageSchema,
  type OwnerProfile,
} from './schemas.js';

export const publicMemberProfileSchema = z.strictObject({
  userId: profileIdentitySchema,
  displayName: displayNameSchema,
  photoAssetId: idSchema.nullable(),
  memberSince: memberSinceSchema,
  headline: headlineSchema,
  stage: profileStageSchema.nullable(),
  introduction: introductionSchema,
  interests: z.array(profileInterestSchema).max(5),
  spokenLanguages: z.array(spokenLanguageSchema).max(6),
  professionalLink: professionalLinkSchema,
});

export type PublicMemberProfile = z.infer<typeof publicMemberProfileSchema>;

/** Project public identity/avatar and opted-in details; authorization and asset delivery stay server-side. */
export const projectPublicProfile = (
  profile: OwnerProfile,
): PublicMemberProfile => ({
  userId: profile.userId,
  displayName: profile.displayName,
  photoAssetId: profile.photoAssetId,
  memberSince: profile.memberSince,
  headline: profile.visibility.headline ? profile.headline : null,
  stage: profile.visibility.stage ? profile.stage : null,
  introduction: profile.introduction,
  interests: profile.visibility.interests ? [...profile.interests] : [],
  spokenLanguages: profile.visibility.spokenLanguages
    ? [...profile.spokenLanguages]
    : [],
  professionalLink: profile.visibility.professionalLink
    ? profile.professionalLink
    : null,
});
