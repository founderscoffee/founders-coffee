import { z } from 'zod';

import {
  notificationDeliveryChannelSchema,
  localeSchema,
  type NotificationDeliveryChannel,
} from '@founders-coffee/core';

const notificationBase = z.object({
  eventTitle: z.string().min(1).max(200),
  eventSlug: z.string().min(1).max(200),
  marketCode: z.string().min(2).max(8),
  startsAt: z.string().min(1),
  venue: z.string().min(1).max(300),
  locale: localeSchema,
  phoneNumber: z.string().min(1).max(32).optional(),
  email: z.string().email().max(254).optional(),
  rsvpCount: z.number().int().nonnegative().optional(),
});

const emailContent = {
  email: z.string().email().max(254),
  subject: z.string().min(1).max(300),
  html: z.string().min(1),
  text: z.string().optional(),
};

export const smsNotificationPayloadSchema = notificationBase
  .extend({
    phoneNumber: z.string().min(1).max(32),
    smsBody: z.string().min(1).max(1600),
  })
  .passthrough();

export const emailNotificationPayloadSchema = notificationBase
  .extend(emailContent)
  .passthrough();

export const pushNotificationPayloadSchema = notificationBase
  .extend({
    pushTitle: z.string().min(1).max(200),
    pushBody: z.string().min(1).max(500),
    pushUrl: z.url().max(2048).optional(),
  })
  .passthrough();

export type SmsNotificationPayload = z.infer<
  typeof smsNotificationPayloadSchema
>;
export type EmailNotificationPayload = z.infer<
  typeof emailNotificationPayloadSchema
>;
export type PushNotificationPayload = z.infer<
  typeof pushNotificationPayloadSchema
>;

export type NotificationChannel = NotificationDeliveryChannel;

export type ParsedNotificationPayload =
  | { readonly channel: 'sms'; readonly payload: SmsNotificationPayload }
  | { readonly channel: 'email'; readonly payload: EmailNotificationPayload }
  | { readonly channel: 'push'; readonly payload: PushNotificationPayload };

const schemaFor = {
  sms: smsNotificationPayloadSchema,
  email: emailNotificationPayloadSchema,
  push: pushNotificationPayloadSchema,
} as const;

/**
 * Parse a stored payload for the channel its row declares.
 *
 * A persisted JSON blob crossing back into code is untrusted input like any other (§7, §10), and a
 * cast is not a check: a row written by an older schema, a partial write, or a future producer
 * previously reached Twilio, Cloudflare Email or FCM with `undefined` where a required field
 * belongs, and the provider error was then recorded as a delivery failure rather than the data
 * defect it is.
 *
 * Unknown keys pass through rather than failing, because the payload is a content envelope that has
 * grown fields before and will again; the schemas assert what each channel needs, not what nothing
 * else may carry.
 *
 * A fallback row inherits its primary's payload unchanged, so a payload has to satisfy both its own
 * channel and the channel named in `fallback_channel`. That is the producer's obligation, asserted
 * where the row is written, not something a channel schema can express — an SMS schema that also
 * demanded email content forced every SMS payload to carry a subject and body for a fallback most
 * of them do not have.
 */
export const parseNotificationPayload = (
  channel: string,
  payload: unknown,
):
  | { readonly ok: true; readonly value: ParsedNotificationPayload }
  | { readonly ok: false; readonly reason: string } => {
  const channelResult = notificationDeliveryChannelSchema.safeParse(channel);
  if (!channelResult.success) {
    return { ok: false, reason: `unknown channel '${channel}'` };
  }
  const schema = schemaFor[channelResult.data];

  const result = schema.safeParse(payload);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return { ok: false, reason: detail };
  }

  return {
    ok: true,
    value: {
      channel: channelResult.data,
      payload: result.data,
    } as ParsedNotificationPayload,
  };
};
