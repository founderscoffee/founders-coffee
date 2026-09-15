import type { CloseoutPromptOutcome } from '@founders-coffee/core';
import { operations } from '@founders-coffee/domain';
import { formatDate } from '@founders-coffee/i18n';
import {
  enqueueNotificationIfAbsent,
  getNotificationContact,
  type Db,
} from '@founders-coffee/db';

import { channelPlanFor } from './channel-plan.js';
import { closeoutUrlFor, resolveNotificationContext } from './context.js';
import { armNotificationSchedule } from './schedule.js';
import { emailPayloadFor, pushPayloadFor } from './templates.js';
import { validPayload } from './producer.js';

export type { CloseoutPromptOutcome } from '@founders-coffee/core';

export interface CloseoutPromptEvent {
  readonly id: string;
  readonly hostId: string;
  readonly marketCode: string;
  readonly title: string;
  readonly venue: string;
  readonly slug: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

/**
 * The row's id, derived from the event rather than generated.
 *
 * This is the whole idempotency story. A generated id would make "have I already scheduled this?" a
 * question someone has to ask before writing, and two writers — the creation hook and the nightly
 * backfill — would both read absent and both insert. Deriving the id lets the primary key answer it
 * inside the statement instead.
 */
export const closeoutPromptId = (eventId: string): string =>
  `ntf_co_${eventId.replace(/^evt_/, '')}`;

/**
 * Ask the host, half an hour after it ends, how the gathering went.
 *
 * Written at creation and again by the nightly backfill for anything that slipped through, both
 * through the same deterministic id, so the second call is a no-op the database decides.
 *
 * `endsAt + 30 minutes` rather than `endsAt`: a host is still saying goodbye at the moment their
 * event ends, and §5.24 makes an event with no recorded end a first-class case rather than bad data
 * — so one without an end is refused here instead of being given an inferred one.
 *
 * The channel plan selects push first with email behind it when both are enabled, or email as the
 * primary when it is the member's only selection. No SMS: `smsBodyFor` excludes this key in its
 * type, because being asked how it went is not the same-day disruption SMS survives for.
 *
 * The market flag is deliberately **not** checked here. §5 gates delivery, and delivery is gated at
 * send time in `resolveDestination`, which is the one place every channel already passes through and
 * is already wrapped against exceptions. Checking it at enqueue instead would mean a market that
 * switches operations on has no intents for anything created while it was off, which is the opposite
 * of "recoverable while disabled".
 */
export const enqueueCloseoutPrompt = async (
  db: Db,
  event: CloseoutPromptEvent,
): Promise<CloseoutPromptOutcome> => {
  if (!event.endsAt) return 'no_end_time';

  const contact = await getNotificationContact(db, event.hostId);
  if (!contact) return 'no_channels';
  const plan = channelPlanFor(contact, 'closeout_prompt');
  if (!plan) return 'no_channels';
  const context = await resolveNotificationContext(db, {
    preferred: contact?.localePref ?? null,
    marketCode: event.marketCode,
  });

  const url = closeoutUrlFor(event.id);
  const values = {
    title: event.title,
    venue: event.venue,
    date: formatDate(event.endsAt, context.locale, {
      timeZone: context.timeZone,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    url,
  };

  const basePayload = {
    email: contact?.email,
    eventTitle: event.title,
    eventSlug: event.slug,
    marketCode: event.marketCode,
    startsAt: event.startsAt.toISOString(),
    venue: event.venue,
    locale: context.locale,
  };

  const payload = {
    ...basePayload,
    ...pushPayloadFor('closeout_prompt', values, context.locale),
    ...emailPayloadFor('closeout_prompt', values, context.locale),
    pushUrl: url,
  };

  const sendAt = new Date(
    event.endsAt.getTime() + operations.CLOSEOUT_PROMPT_DELAY_MS,
  );

  const { written } = await enqueueNotificationIfAbsent(db, {
    id: closeoutPromptId(event.id),
    eventId: event.id,
    userId: event.hostId,
    channel: plan.primary,
    templateKey: 'closeout_prompt',
    payload: plan.fallback
      ? validPayload(plan.fallback, validPayload(plan.primary, payload))
      : validPayload(plan.primary, payload),
    sendAt,
    fallbackChannel: plan.fallback ?? undefined,
  });

  if (!written) return 'already_scheduled';

  await armNotificationSchedule(event.id, sendAt);
  return 'scheduled';
};
