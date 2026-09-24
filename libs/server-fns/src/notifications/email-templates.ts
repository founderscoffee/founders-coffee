import { renderEmail } from '@founders-coffee/email';
import { NotificationEmail } from '@founders-coffee/email/templates';
import {
  ntf_email_closeout_prompt_html,
  ntf_email_closeout_prompt_subject,
  ntf_email_closeout_prompt_text,
  ntf_email_calendar_html,
  ntf_email_calendar_text,
  ntf_email_confirmation_html,
  ntf_email_confirmation_subject,
  ntf_email_confirmation_text,
  ntf_email_did_not_happen_html,
  ntf_email_did_not_happen_subject,
  ntf_email_did_not_happen_text,
  ntf_email_event_cancelled_html,
  ntf_email_event_cancelled_subject,
  ntf_email_event_cancelled_text,
  ntf_email_event_relocated_html,
  ntf_email_event_relocated_subject,
  ntf_email_event_relocated_text,
  ntf_email_event_rescheduled_html,
  ntf_email_event_rescheduled_subject,
  ntf_email_event_rescheduled_text,
  ntf_email_feedback_invitation_html,
  ntf_email_feedback_invitation_subject,
  ntf_email_feedback_invitation_text,
  ntf_email_reminder_24h_html,
  ntf_email_reminder_24h_subject,
  ntf_email_reminder_24h_text,
  ntf_email_reminder_72h_html,
  ntf_email_reminder_72h_subject,
  ntf_email_reminder_72h_text,
  ntf_email_rsvp_cancelled_html,
  ntf_email_rsvp_cancelled_subject,
  ntf_email_rsvp_cancelled_text,
  ntf_email_rsvp_received_html,
  ntf_email_rsvp_received_subject,
  ntf_email_rsvp_received_text,
  type Locale,
} from '@founders-coffee/i18n';
import type { NotificationTemplateKey } from '@founders-coffee/core';

import {
  escapeValues,
  withReason,
  type CalendarLinks,
  type TemplateValues,
} from './templates.js';

type EmailPayload = { subject: string; html: string; text: string };

/**
 * Follow a confirmation with the links that add the meetup to a calendar, when it carries them.
 *
 * Only the confirmation does (#21). It answers the RSVP, the moment a member decides where the
 * meetup goes in their week, and the event page offers the same two links from then on. The offer
 * is a block of its own, like the host's reason, so a locale can word it without the confirmation
 * changing. Like every HTML variant, this one takes the escaped links.
 */
const withCalendarHtml = (
  html: string,
  links: CalendarLinks | undefined,
  locale: Locale,
): string =>
  links ? `${html}${ntf_email_calendar_html(links, { locale })}` : html;

/** The plain-text form of {@link withCalendarHtml}: the raw links, after a blank line. */
const withCalendarText = (
  text: string,
  links: CalendarLinks | undefined,
  locale: Locale,
): string =>
  links ? `${text}\n\n${ntf_email_calendar_text(links, { locale })}` : text;

const renderNotificationEmail = async (
  locale: Locale,
  subject: string,
  bodyHtml: string,
  text: string,
): Promise<EmailPayload> => {
  const rendered = await renderEmail(
    NotificationEmail,
    { locale, preview: subject, bodyHtml },
    text,
  );
  return { subject, html: rendered.html, text: rendered.text };
};

export const emailPayloadFor = async (
  templateKey: NotificationTemplateKey,
  values: TemplateValues,
  locale: Locale,
): Promise<EmailPayload> => {
  const options = { locale };
  const safe = escapeValues(values);
  switch (templateKey) {
    case 'event_did_not_happen':
      return renderNotificationEmail(
        locale,
        ntf_email_did_not_happen_subject(values, options),
        ntf_email_did_not_happen_html(safe, options),
        ntf_email_did_not_happen_text(values, options),
      );
    case 'feedback_invitation':
      return renderNotificationEmail(
        locale,
        ntf_email_feedback_invitation_subject(values, options),
        ntf_email_feedback_invitation_html(safe, options),
        ntf_email_feedback_invitation_text(values, options),
      );
    case 'closeout_prompt':
      return renderNotificationEmail(
        locale,
        ntf_email_closeout_prompt_subject(values, options),
        ntf_email_closeout_prompt_html(safe, options),
        ntf_email_closeout_prompt_text(values, options),
      );
    case 'rsvp_received':
      return renderNotificationEmail(
        locale,
        ntf_email_rsvp_received_subject(values, options),
        ntf_email_rsvp_received_html(safe, options),
        ntf_email_rsvp_received_text(values, options),
      );
    case 'rsvp_cancelled':
      return renderNotificationEmail(
        locale,
        ntf_email_rsvp_cancelled_subject(values, options),
        ntf_email_rsvp_cancelled_html(safe, options),
        ntf_email_rsvp_cancelled_text(values, options),
      );
    case 'rsvp_confirmation':
      return renderNotificationEmail(
        locale,
        ntf_email_confirmation_subject(values, options),
        withCalendarHtml(
          ntf_email_confirmation_html(safe, options),
          safe.calendar,
          locale,
        ),
        withCalendarText(
          ntf_email_confirmation_text(values, options),
          values.calendar,
          locale,
        ),
      );
    case 'reminder_72h':
      return renderNotificationEmail(
        locale,
        ntf_email_reminder_72h_subject(values, options),
        ntf_email_reminder_72h_html(safe, options),
        ntf_email_reminder_72h_text(values, options),
      );
    case 'reminder_24h':
      return renderNotificationEmail(
        locale,
        ntf_email_reminder_24h_subject(values, options),
        ntf_email_reminder_24h_html(safe, options),
        ntf_email_reminder_24h_text(values, options),
      );
    case 'event_cancelled':
      return renderNotificationEmail(
        locale,
        ntf_email_event_cancelled_subject(values, options),
        withReason(
          ntf_email_event_cancelled_html(safe, options),
          safe.reason,
          locale,
        ),
        withReason(
          ntf_email_event_cancelled_text(values, options),
          values.reason,
          locale,
        ),
      );
    case 'event_rescheduled':
      return renderNotificationEmail(
        locale,
        ntf_email_event_rescheduled_subject(values, options),
        ntf_email_event_rescheduled_html(safe, options),
        ntf_email_event_rescheduled_text(values, options),
      );
    case 'event_relocated':
      return renderNotificationEmail(
        locale,
        ntf_email_event_relocated_subject(values, options),
        ntf_email_event_relocated_html(safe, options),
        ntf_email_event_relocated_text(values, options),
      );
  }
};
