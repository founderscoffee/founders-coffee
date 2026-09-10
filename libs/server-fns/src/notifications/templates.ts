import {
  ntf_cancel_reason,
  ntf_email_confirmation_html,
  ntf_email_confirmation_subject,
  ntf_email_confirmation_text,
  ntf_email_reminder_24h_html,
  ntf_email_reminder_24h_subject,
  ntf_email_reminder_24h_text,
  ntf_email_reminder_72h_html,
  ntf_email_reminder_72h_subject,
  ntf_email_reminder_72h_text,
  ntf_email_event_cancelled_html,
  ntf_email_event_cancelled_subject,
  ntf_email_event_cancelled_text,
  ntf_push_confirmation_body,
  ntf_push_confirmation_title,
  ntf_push_event_cancelled_body,
  ntf_push_event_cancelled_title,
  ntf_push_reminder_24h_body,
  ntf_push_reminder_24h_title,
  ntf_push_reminder_72h_body,
  ntf_push_reminder_72h_title,
  ntf_sms_confirmation,
  ntf_sms_event_cancelled,
  ntf_sms_reminder_24h,
  ntf_sms_reminder_72h,
  type Locale,
} from '@founders-coffee/i18n';

export type NotificationTemplateKey =
  'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h' | 'event_cancelled';

export interface TemplateValues {
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly url: string;
  readonly reason?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    if (character === '"') return '&quot;';
    return '&#39;';
  });

/**
 * Escape every interpolated value before it reaches an HTML template.
 *
 * Paraglide substitutes placeholders verbatim, so a message containing markup interpolates whatever
 * it is handed. The title and venue are user-authored and the URL carries a slug, so all of them are
 * escaped for the HTML variants and left alone for the plain-text and SMS ones.
 */
const escapeValues = (values: TemplateValues): TemplateValues => ({
  title: escapeHtml(values.title),
  venue: escapeHtml(values.venue),
  date: escapeHtml(values.date),
  url: escapeHtml(values.url),
  reason: values.reason ? escapeHtml(values.reason) : undefined,
});

/**
 * Append the host's reason to a cancellation body when they wrote one. `TemplateValues.reason`
 * carries it and only `event_cancelled` renders it; every other template ignores the field.
 *
 * The reason is free text a host typed, so it is added as its own sentence rather than
 * interpolated into the message — a locale whose word order puts it elsewhere can move
 * `ntf_cancel_reason` without the caller changing.
 */
const withReason = (
  body: string,
  reason: string | undefined,
  locale: Locale,
): string =>
  reason ? `${body} ${ntf_cancel_reason({ reason }, { locale })}` : body;

export const smsBodyFor = (
  templateKey: NotificationTemplateKey,
  values: TemplateValues,
  locale: Locale,
): string => {
  const options = { locale };
  switch (templateKey) {
    case 'rsvp_confirmation':
      return ntf_sms_confirmation(values, options);
    case 'reminder_72h':
      return ntf_sms_reminder_72h(values, options);
    case 'reminder_24h':
      return ntf_sms_reminder_24h(values, options);
    case 'event_cancelled':
      return withReason(
        ntf_sms_event_cancelled(values, options),
        values.reason,
        locale,
      );
  }
};

export const emailPayloadFor = (
  templateKey: NotificationTemplateKey,
  values: TemplateValues,
  locale: Locale,
): { subject: string; html: string; text: string } => {
  const options = { locale };
  const safe = escapeValues(values);
  switch (templateKey) {
    case 'rsvp_confirmation':
      return {
        subject: ntf_email_confirmation_subject(values, options),
        html: ntf_email_confirmation_html(safe, options),
        text: ntf_email_confirmation_text(values, options),
      };
    case 'reminder_72h':
      return {
        subject: ntf_email_reminder_72h_subject(values, options),
        html: ntf_email_reminder_72h_html(safe, options),
        text: ntf_email_reminder_72h_text(values, options),
      };
    case 'reminder_24h':
      return {
        subject: ntf_email_reminder_24h_subject(values, options),
        html: ntf_email_reminder_24h_html(safe, options),
        text: ntf_email_reminder_24h_text(values, options),
      };
    case 'event_cancelled':
      return {
        subject: ntf_email_event_cancelled_subject(values, options),
        html: withReason(
          ntf_email_event_cancelled_html(safe, options),
          safe.reason,
          locale,
        ),
        text: withReason(
          ntf_email_event_cancelled_text(values, options),
          values.reason,
          locale,
        ),
      };
  }
};

/**
 * The title, body and destination one push carries.
 *
 * `pushUrl` is what a tap resolves to. It was absent for the life of the feature: the payload schema
 * held only a title and a body, the dispatcher passed only those two, and the service worker's click
 * handler fell back to `/` — so a reminder about a specific gathering would have opened the home
 * page. `values.url` has been carrying the right link the whole time for the email and SMS bodies;
 * this only stops throwing it away.
 */
export const pushPayloadFor = (
  templateKey: NotificationTemplateKey,
  values: TemplateValues,
  locale: Locale,
): { pushTitle: string; pushBody: string; pushUrl: string } => {
  const options = { locale };
  const pushUrl = values.url;
  if (templateKey === 'event_cancelled') {
    return {
      pushTitle: ntf_push_event_cancelled_title(values, options),
      pushBody: ntf_push_event_cancelled_body(values, options),
      pushUrl,
    };
  }
  if (templateKey === 'rsvp_confirmation') {
    return {
      pushTitle: ntf_push_confirmation_title(values, options),
      pushBody: ntf_push_confirmation_body({}, options),
      pushUrl,
    };
  }
  return templateKey === 'reminder_72h'
    ? {
        pushTitle: ntf_push_reminder_72h_title(values, options),
        pushBody: ntf_push_reminder_72h_body({}, options),
        pushUrl,
      }
    : {
        pushTitle: ntf_push_reminder_24h_title(values, options),
        pushBody: ntf_push_reminder_24h_body({}, options),
        pushUrl,
      };
};
