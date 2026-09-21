import { z } from 'zod';

import {
  accountStateSchema as coreAccountStateSchema,
  NOTIFICATION_PREFERENCE_CHANNELS,
  notificationPreferenceChannelSchema,
} from '@founders-coffee/core';

import { profileRevisionSchema } from './schemas.js';

export const accountStateSchema = coreAccountStateSchema;
export type { AccountState } from '@founders-coffee/core';

export const NOTIFICATION_CHANNELS = NOTIFICATION_PREFERENCE_CHANNELS;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export const notificationChannelSchema = notificationPreferenceChannelSchema;
export const notificationChannelsSchema = z
  .array(notificationChannelSchema)
  .max(NOTIFICATION_CHANNELS.length)
  .refine((channels) => new Set(channels).size === channels.length);
export const DEFAULT_NOTIFICATION_CHANNELS = [
  ...NOTIFICATION_CHANNELS,
] as const;
export const DEFAULT_FOLLOW_UP_CHANNELS = ['email'] as const;

export const channelsToMask = (
  channels: readonly NotificationChannel[],
): number =>
  channels.reduce((mask, channel) => mask | (channel === 'push' ? 1 : 4), 0);

export const maskToChannels = (mask: number): NotificationChannel[] => {
  const channels: NotificationChannel[] = [];
  if ((mask & 1) === 1) channels.push('push');
  if ((mask & 4) === 4) channels.push('email');
  return channels;
};

export const notificationPreferencesSchema = z.strictObject({
  eventUpdates: z.boolean().default(true),
  eventUpdatesChannels: notificationChannelsSchema.default([
    ...DEFAULT_NOTIFICATION_CHANNELS,
  ]),
  eventReminders: z.boolean().default(true),
  eventRemindersChannels: notificationChannelsSchema.default([
    ...DEFAULT_NOTIFICATION_CHANNELS,
  ]),
  hostRsvpReceived: z.boolean().default(true),
  hostRsvpReceivedChannels: notificationChannelsSchema.default([
    ...DEFAULT_NOTIFICATION_CHANNELS,
  ]),
  hostRsvpCancelled: z.boolean().default(true),
  hostRsvpCancelledChannels: notificationChannelsSchema.default([
    ...DEFAULT_NOTIFICATION_CHANNELS,
  ]),
  followUpPrompts: z.boolean().default(true),
  followUpPromptsChannels: notificationChannelsSchema.default([
    ...DEFAULT_FOLLOW_UP_CHANNELS,
  ]),
  pushEnabled: z.boolean().default(false),
  smsFallbackEnabled: z.boolean().default(false),
});

export const updateAccountPreferencesSchema = notificationPreferencesSchema
  .omit({ pushEnabled: true })
  .extend({
    expectedRevision: profileRevisionSchema,
  });

export const accountPreferencesViewSchema = z.strictObject({
  revision: profileRevisionSchema,
  preferences: notificationPreferencesSchema,
  smsAvailable: z.boolean(),
  smsConsentAt: z.string().nullable(),
});

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type AccountPreferencesView = z.infer<
  typeof accountPreferencesViewSchema
>;
export type UpdateAccountPreferencesInput = z.infer<
  typeof updateAccountPreferencesSchema
>;
