import { z } from 'zod';

import { localeSchema } from '@founders-coffee/core';

import { profileRevisionSchema } from './schemas.js';

export const accountStateSchema = z.enum(['active', 'closing', 'deleted']);
export type AccountState = z.infer<typeof accountStateSchema>;

export const notificationPreferencesSchema = z.strictObject({
  eventUpdates: z.boolean().default(true),
  eventReminders: z.boolean().default(true),
  hostUpdates: z.boolean().default(true),
  followUpPrompts: z.boolean().default(false),
  pushEnabled: z.boolean().default(false),
  smsFallbackEnabled: z.boolean().default(false),
});

export const updateAccountPreferencesSchema =
  notificationPreferencesSchema.extend({
    locale: localeSchema.nullable(),
    expectedRevision: profileRevisionSchema,
  });

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>;
export type UpdateAccountPreferencesInput = z.infer<
  typeof updateAccountPreferencesSchema
>;
