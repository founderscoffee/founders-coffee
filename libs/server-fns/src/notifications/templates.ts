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
  ntf_push_did_not_happen_body,
  ntf_push_did_not_happen_title,
  ntf_email_did_not_happen_html,
  ntf_email_did_not_happen_subject,
  ntf_email_did_not_happen_text,
  ntf_push_closeout_prompt_body,
  ntf_push_closeout_prompt_title,
  ntf_email_closeout_prompt_html,
  ntf_email_closeout_prompt_subject,
  ntf_email_closeout_prompt_text,
  ntf_push_rsvp_received_body,
  ntf_push_rsvp_received_title,
  ntf_email_rsvp_received_html,
  ntf_email_rsvp_received_subject,
  ntf_email_rsvp_received_text,
  ntf_push_feedback_invitation_body,
  ntf_push_feedback_invitation_title,
  ntf_email_feedback_invitation_html,
  ntf_email_feedback_invitation_subject,
  ntf_email_feedback_invitation_text,
  ntf_sms_confirmation,
  ntf_sms_event_cancelled,
  ntf_sms_reminder_24h,
  ntf_sms_reminder_72h,
  type Locale,
} from '@founders-coffee/i18n';

export type NotificationTemplateKey =
  | 'rsvp_confirmation'
  | 'reminder_72h'
  | 'reminder_24h'
  | 'event_cancelled'
  | 'rsvp_received'
  | 'closeout_prompt'
  | 'event_did_not_happen'
  | 'feedback_invitation';

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

/**
 * The SMS form of a message, for the keys that have one.
 *
 * `rsvp_received` and `closeout_prompt` are excluded in the type rather than handled and refused at
 * runtime. ND-07 left exactly one thing on SMS — a cancellation close enough to the start that an
 * unread email means somebody sets off anyway — and neither a host learning that a guest is coming
 * nor a host being asked how it went is that. Asking for an SMS body this product has decided not to
 * write should not compile.
 */
export const smsBodyFor = (
  templateKey: Exclude<
    NotificationTemplateKey,
    | 'rsvp_received'
    | 'closeout_prompt'
    | 'event_did_not_happen'
    | 'feedback_invitation'
  >,
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
    case 'event_did_not_happen':
      return {
        subject: ntf_email_did_not_happen_subject(values, options),
        html: ntf_email_did_not_happen_html(safe, options),
        text: ntf_email_did_not_happen_text(values, options),
      };
    case 'feedback_invitation':
      return {
        subject: ntf_email_feedback_invitation_subject(values, options),
        html: ntf_email_feedback_invitation_html(safe, options),
        text: ntf_email_feedback_invitation_text(values, options),
      };
    case 'closeout_prompt':
      return {
        subject: ntf_email_closeout_prompt_subject(values, options),
        html: ntf_email_closeout_prompt_html(safe, options),
        text: ntf_email_closeout_prompt_text(values, options),
      };
    case 'rsvp_received':
      return {
        subject: ntf_email_rsvp_received_subject(values, options),
        html: ntf_email_rsvp_received_html(safe, options),
        text: ntf_email_rsvp_received_text(values, options),
      };
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
  if (templateKey === 'event_did_not_happen') {
    return {
      pushTitle: ntf_push_did_not_happen_title(values, options),
      pushBody: ntf_push_did_not_happen_body({}, options),
      pushUrl,
    };
  }
  if (templateKey === 'feedback_invitation') {
    return {
      pushTitle: ntf_push_feedback_invitation_title(values, options),
      pushBody: ntf_push_feedback_invitation_body({}, options),
      pushUrl,
    };
  }
  if (templateKey === 'closeout_prompt') {
    return {
      pushTitle: ntf_push_closeout_prompt_title(values, options),
      pushBody: ntf_push_closeout_prompt_body({}, options),
      pushUrl,
    };
  }
  if (templateKey === 'rsvp_received') {
    return {
      pushTitle: ntf_push_rsvp_received_title(values, options),
      pushBody: ntf_push_rsvp_received_body({}, options),
      pushUrl,
    };
  }
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
