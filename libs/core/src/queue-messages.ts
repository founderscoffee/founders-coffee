export interface NotificationDueMessage {
  readonly kind: 'notification_due';
  readonly eventId: string;
}

export interface WaitlistLaunchDueMessage {
  readonly kind: 'waitlist_launch_due';
  readonly launchId: string;
  readonly eventId: string;
}

export type AppQueueMessage = NotificationDueMessage | WaitlistLaunchDueMessage;
