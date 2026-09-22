import { formatDate } from '@founders-coffee/i18n';
import { operations } from '@founders-coffee/domain';
import {
  communityOperationsEnabled,
  getCloseout,
  enqueueNotificationIfAbsent,
  getNotificationContact,
  listAttendance,
  type Db,
} from '@founders-coffee/db';

import { feedbackUrlFor, resolveNotificationContext } from './context.js';
import { channelPlanFor } from './channel-plan.js';
import { armNotificationSchedule } from './schedule.js';
import { pushPayloadFor } from './templates.js';
import { emailPayloadFor } from './email-templates.js';
import { validPayload } from './producer.js';

export interface FeedbackInvitationEvent {
  readonly id: string;
  readonly marketCode: string;
  readonly title: string;
  readonly venue: string;
  readonly slug: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

export const feedbackInvitationId = (eventId: string, userId: string): string =>
  `ntf_fb_${eventId.replace(/^evt_/, '')}_${userId}`;

export const enqueueFeedbackInvitations = async (
  db: Db,
  event: FeedbackInvitationEvent,
): Promise<number> => {
  if (!event.endsAt) return 0;
  if (!(await communityOperationsEnabled(db, event.marketCode))) return 0;
  const closeout = await getCloseout(db, event.id);
  if (
    !closeout ||
    closeout.outcome !== 'held' ||
    closeout.submittedAt.getTime() - event.endsAt.getTime() >
      operations.FEEDBACK_INVITE_WITHIN_MS
  )
    return 0;
  const attendance = await listAttendance(db, event.id);
  let scheduled = 0;
  const sendAt = new Date();
  for (const member of attendance.filter((row) => row.outcome === 'attended')) {
    const contact = await getNotificationContact(db, member.userId);
    if (!contact) continue;
    const context = await resolveNotificationContext(db, {
      preferred: contact.localePref,
      marketCode: event.marketCode,
    });
    const plan = channelPlanFor(contact, 'feedback_invitation');
    if (!plan) continue;
    const values = {
      title: event.title,
      venue: event.venue,
      address: event.venue,
      date: formatDate(event.endsAt, context.locale, {
        timeZone: context.timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      url: feedbackUrlFor(context.locale, event.id),
    };
    const payload = {
      email: contact.email,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt.toISOString(),
      venue: event.venue,
      locale: context.locale,
      ...pushPayloadFor('feedback_invitation', values, context.locale),
      ...(await emailPayloadFor('feedback_invitation', values, context.locale)),
      pushUrl: values.url,
    };
    const result = await enqueueNotificationIfAbsent(db, {
      id: feedbackInvitationId(event.id, member.userId),
      eventId: event.id,
      userId: member.userId,
      channel: plan.primary,
      templateKey: 'feedback_invitation',
      payload: plan.fallback
        ? validPayload(plan.fallback, validPayload(plan.primary, payload))
        : validPayload(plan.primary, payload),
      sendAt,
      fallbackChannel: plan.fallback ?? undefined,
    });
    if (result.written) scheduled += 1;
  }
  if (scheduled > 0) await armNotificationSchedule(event.id, sendAt);
  return scheduled;
};
