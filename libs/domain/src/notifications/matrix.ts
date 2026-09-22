import { z } from 'zod';

import type { NotificationFallbackChannel } from '@founders-coffee/core';

import {
  maskToChannels,
  type NotificationChannel,
} from '../profile/preferences.js';

export const NOTIFICATION_CATEGORIES = [
  'eventUpdatesChannels',
  'eventRemindersChannels',
  'hostRsvpReceivedChannels',
  'hostRsvpCancelledChannels',
  'followUpPromptsChannels',
] as const;

export const notificationCategorySchema = z.enum(NOTIFICATION_CATEGORIES);
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationCategoryMasks = Readonly<
  Record<NotificationCategory, number>
>;

export interface NotificationChannelSelection {
  readonly primary: NotificationChannel;
  readonly fallback: NotificationFallbackChannel | null;
}

const allCategoryChannels = (masks: NotificationCategoryMasks): number =>
  masks.eventUpdatesChannels |
  masks.eventRemindersChannels |
  masks.hostRsvpReceivedChannels |
  masks.hostRsvpCancelledChannels |
  masks.followUpPromptsChannels;

/** Return the member-facing category controlled by a notification template. */
export const notificationCategoryForTemplate = (
  templateKey: string | undefined,
): NotificationCategory | null => {
  switch (templateKey) {
    case 'event_cancelled':
    case 'event_rescheduled':
    case 'event_did_not_happen':
      return 'eventUpdatesChannels';
    case 'reminder_72h':
    case 'reminder_24h':
      return 'eventRemindersChannels';
    case 'rsvp_received':
      return 'hostRsvpReceivedChannels';
    case 'rsvp_cancelled':
      return 'hostRsvpCancelledChannels';
    case 'feedback_invitation':
      return 'followUpPromptsChannels';
    default:
      return null;
  }
};

/** Resolve the channel mask for a template, using all category choices for transactional notices. */
export const notificationMaskForTemplate = (
  templateKey: string | undefined,
  masks: NotificationCategoryMasks,
): number => {
  const category = notificationCategoryForTemplate(templateKey);
  return category ? masks[category] : allCategoryChannels(masks);
};

/** Select push first and email second from a mask, or no delivery when the mask is empty. */
export const selectNotificationChannels = (
  mask: number,
): NotificationChannelSelection | null => {
  const channels = maskToChannels(mask);
  const primary = channels[0];
  if (!primary) return null;
  return { primary, fallback: channels[1] === 'email' ? 'email' : null };
};

/** Check whether a member-selected push or email channel remains enabled. */
export const isNotificationChannelEnabled = (
  mask: number,
  channel: NotificationChannel,
): boolean => maskToChannels(mask).includes(channel);
