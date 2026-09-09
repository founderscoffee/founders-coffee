import { z } from 'zod';

import { profile } from '@founders-coffee/domain';

import { RATE_BUDGETS } from '../rate-budgets.js';

const token = z.string().trim().max(2048).optional();
export const publicProfileRequestSchema = z.strictObject({
  userId: profile.profileIdentitySchema,
});
export const emptyProfileRequestSchema = z.strictObject({});
export const reservePhotoRequestSchema = z.strictObject({
  turnstileToken: token,
});
export const updateProfileRequestSchema = z.strictObject({
  profile: profile.updateProfileSchema,
  turnstileToken: token,
});
export const updateDisplayNameRequestSchema = z.strictObject({
  displayName: profile.displayNameSchema,
  expectedRevision: profile.profileRevisionSchema,
  turnstileToken: token,
});
export const PROFILE_UPDATE_LIMIT = RATE_BUDGETS.edit.profileUpdate;
export const PROFILE_READ_LIMIT = RATE_BUDGETS.read.publicProfile;
export const PHOTO_RESERVE_LIMIT = RATE_BUDGETS.expensive.photoReservation;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateDisplayNameRequest = z.infer<
  typeof updateDisplayNameRequestSchema
>;
export type UserProfile = profile.OwnerProfile;
export type PublicProfile = profile.PublicMemberProfile;
