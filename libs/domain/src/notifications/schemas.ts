import { z } from 'zod';

const LOCALES = ['ar', 'fr', 'en'] as const;

const notificationBase = z.object({
  eventTitle: z.string().min(1).max(200),
  eventSlug: z.string().min(1).max(200),
  marketCode: z.string().min(2).max(8),
  startsAt: z.string().min(1),
  venue: z.string().min(1).max(300),
  locale: z.enum(LOCALES),
  phoneNumber: z.string().min(1).max(32).optional(),
  email: z.string().email().max(254).optional(),
  rsvpCount: z.number().int().nonnegative().optional(),
  capacity: z.number().int().nonnegative().optional(),
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
  .extend(emailContent)
  .passthrough();

export const emailNotificationPayloadSchema = notificationBase
  .extend(emailContent)
  .passthrough();

export const pushNotificationPayloadSchema = notificationBase
  .extend({
    pushTitle: z.string().min(1).max(200),
    pushBody: z.string().min(1).max(500),
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

export type NotificationChannel = 'sms' | 'email' | 'push';

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
 * `smsNotificationPayloadSchema` also requires the email content, which looks redundant and is not:
 * a row with `fallback_channel = 'email'` hands its payload to the fallback row unchanged, so an
 * SMS payload without a subject and body produced a fallback email with neither. Requiring them on
 * the SMS schema is what makes that fallback deliverable.
 */
export const parseNotificationPayload = (
  channel: string,
  payload: unknown,
):
  | { readonly ok: true; readonly value: ParsedNotificationPayload }
  | { readonly ok: false; readonly reason: string } => {
  const schema = schemaFor[channel as NotificationChannel];
  if (!schema) {
    return { ok: false, reason: `unknown channel '${channel}'` };
  }

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
      channel,
      payload: result.data,
    } as ParsedNotificationPayload,
  };
};
