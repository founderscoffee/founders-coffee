import { notifications } from '@founders-coffee/domain';
import type { NotificationContact } from '@founders-coffee/db';

export const channelPlanFor = (
  contact: NotificationContact,
  templateKey: string,
): notifications.NotificationChannelSelection | null =>
  notifications.selectNotificationChannels(
    notifications.notificationMaskForTemplate(templateKey, contact),
  );
