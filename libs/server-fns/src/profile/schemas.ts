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
const emailField = z.string().trim().toLowerCase().email().max(320);
const phoneField = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use an international number, starting with +');
const otpField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the six-digit code');
export const emailChangeRequestSchema = z.strictObject({
  newEmail: emailField,
  otp: otpField,
  turnstileToken: token,
});
export const phoneCodeRequestSchema = z.strictObject({
  phoneNumber: phoneField,
  turnstileToken: token,
});
export const revokeDeviceRequestSchema = z.strictObject({
  sessionId: z.string().trim().min(1).max(128).optional(),
  othersOnly: z.boolean().optional(),
});
export const unlinkProviderRequestSchema = z.strictObject({
  providerId: z.enum(profile.ACCOUNT_PROVIDERS),
});
export const phoneConfirmRequestSchema = z.strictObject({
  phoneNumber: phoneField,
  otp: otpField,
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
export const CONTACT_CODE_LIMIT = RATE_BUDGETS.otp.contactCode;
export const CONTACT_CHANGE_LIMIT = RATE_BUDGETS.otp.contactChange;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type UpdateDisplayNameRequest = z.infer<
  typeof updateDisplayNameRequestSchema
>;
export type UserProfile = profile.OwnerProfile;
export type PublicProfile = profile.PublicMemberProfile;
export type AccountSummary = profile.AccountSummary;
export type { DeviceList, SessionSummary } from './sessions.js';
