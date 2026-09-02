import {
  ntf_email_confirmation_html,
  ntf_email_confirmation_subject,
  ntf_email_confirmation_text,
  ntf_email_reminder_24h_html,
  ntf_email_reminder_24h_subject,
  ntf_email_reminder_24h_text,
  ntf_email_reminder_72h_html,
  ntf_email_reminder_72h_subject,
  ntf_email_reminder_72h_text,
  ntf_push_reminder_24h_body,
  ntf_push_reminder_24h_title,
  ntf_push_reminder_72h_body,
  ntf_push_reminder_72h_title,
  ntf_sms_confirmation,
  ntf_sms_reminder_24h,
  ntf_sms_reminder_72h,
  type Locale,
} from '@founders-coffee/i18n';

export type NotificationTemplateKey =
  'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h';

export interface TemplateValues {
  readonly title: string;
  readonly venue: string;
  readonly date: string;
  readonly url: string;
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
});

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
  }
};

export const pushPayloadFor = (
  templateKey: 'reminder_72h' | 'reminder_24h',
  values: TemplateValues,
  locale: Locale,
): { pushTitle: string; pushBody: string } => {
  const options = { locale };
  return templateKey === 'reminder_72h'
    ? {
        pushTitle: ntf_push_reminder_72h_title(values, options),
        pushBody: ntf_push_reminder_72h_body({}, options),
      }
    : {
        pushTitle: ntf_push_reminder_24h_title(values, options),
        pushBody: ntf_push_reminder_24h_body({}, options),
      };
};
