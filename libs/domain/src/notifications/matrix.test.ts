import { describe, expect, it } from 'vitest';

import {
  isNotificationChannelEnabled,
  NOTIFICATION_CATEGORIES,
  notificationCategoryForTemplate,
  notificationMaskForTemplate,
  notificationCategorySchema,
  selectNotificationChannels,
  type NotificationCategory,
} from './matrix.js';

const masks = {
  eventUpdatesChannels: 4,
  eventRemindersChannels: 1,
  hostRsvpReceivedChannels: 5,
  hostRsvpCancelledChannels: 5,
  followUpPromptsChannels: 0,
} as const;

describe('notification channel matrix', () => {
  it('keeps category keys unique and schema-backed', () => {
    expect(new Set(NOTIFICATION_CATEGORIES).size).toBe(
      NOTIFICATION_CATEGORIES.length,
    );
    for (const category of NOTIFICATION_CATEGORIES)
      expect(notificationCategorySchema.parse(category)).toBe(category);
  });

  it.each([
    ['event_cancelled', 'eventUpdatesChannels'],
    ['event_did_not_happen', 'eventUpdatesChannels'],
    ['reminder_24h', 'eventRemindersChannels'],
    ['rsvp_received', 'hostRsvpReceivedChannels'],
    ['rsvp_cancelled', 'hostRsvpCancelledChannels'],
    ['feedback_invitation', 'followUpPromptsChannels'],
  ] as const)('maps %s to %s', (template, category: NotificationCategory) => {
    expect(notificationCategoryForTemplate(template)).toBe(category);
    expect(notificationMaskForTemplate(template, masks)).toBe(masks[category]);
  });

  it('uses the union for transactional and operational notices', () => {
    expect(notificationCategoryForTemplate('rsvp_confirmation')).toBeNull();
    expect(notificationMaskForTemplate('rsvp_confirmation', masks)).toBe(5);
    expect(notificationMaskForTemplate('closeout_prompt', masks)).toBe(5);
  });

  it('selects push before email and leaves no fallback for one channel', () => {
    expect(selectNotificationChannels(5)).toEqual({
      primary: 'push',
      fallback: 'email',
    });
    expect(selectNotificationChannels(4)).toEqual({
      primary: 'email',
      fallback: null,
    });
    expect(selectNotificationChannels(0)).toBeNull();
  });

  it('checks only member-controlled channels', () => {
    expect(isNotificationChannelEnabled(4, 'email')).toBe(true);
    expect(isNotificationChannelEnabled(4, 'push')).toBe(false);
  });
});
