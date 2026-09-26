import type { NotificationDispatchKind } from '@founders-coffee/core';
import type { ScheduledNotification } from '@founders-coffee/db';
import type { notifications } from '@founders-coffee/domain';

export type DispatchOutcome =
  | { readonly kind: Extract<NotificationDispatchKind, 'sent'> }
  | {
      readonly kind: Extract<NotificationDispatchKind, 'failed'>;
      readonly permanent: boolean;
      readonly error: string;
      readonly unreachable?: boolean;
      readonly suppressFallback?: boolean;
    };

export type Dispatcher = (
  notification: ScheduledNotification,
  payload: notifications.ParsedNotificationPayload,
) => Promise<DispatchOutcome>;
