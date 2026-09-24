import {
  ASSUMED_DURATION_SECONDS,
  TELEGRAM_GROUP_CLOSES_AFTER_SECONDS,
  type Event,
} from '@founders-coffee/db';

/** When a meetup is over: its end, or its start plus the two hours the live room assumes without one. */
export const meetupEndsAt = (event: Pick<Event, 'startsAt' | 'endsAt'>): Date =>
  event.endsAt ??
  new Date(event.startsAt.getTime() + ASSUMED_DURATION_SECONDS * 1000);

/** When the bot says goodbye and stops admitting anyone: a day after the meetup is over. */
export const telegramWrapUpAt = (
  event: Pick<Event, 'startsAt' | 'endsAt'>,
): Date =>
  new Date(
    meetupEndsAt(event).getTime() + TELEGRAM_GROUP_CLOSES_AFTER_SECONDS * 1000,
  );

/**
 * Whether a group can still be connected to the meetup: it is published and not yet over.
 *
 * The statement that connects a group checks the same, so a host is never handed a link that could
 * not connect anything.
 */
export const isConnectable = (
  event: Pick<Event, 'status' | 'startsAt' | 'endsAt'>,
  now: Date,
): boolean =>
  event.status === 'published' && meetupEndsAt(event).getTime() > now.getTime();

/**
 * Whether the bot still lets members in: the meetup is published and not a day past its end.
 *
 * The statement that admits a member checks the same, so a member is never shown a way into a group
 * that would turn them away.
 */
export const isAdmitting = (
  event: Pick<Event, 'status' | 'startsAt' | 'endsAt'>,
  now: Date,
): boolean =>
  event.status === 'published' &&
  telegramWrapUpAt(event).getTime() > now.getTime();
