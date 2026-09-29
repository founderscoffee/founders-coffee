import { localizedName } from '@founders-coffee/core';
import type { Db, Event } from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';
import {
  cityInputs,
  ntf_email_waitlist_launch_html,
  ntf_email_waitlist_launch_subject,
  ntf_email_waitlist_launch_text,
  type Locale,
} from '@founders-coffee/i18n';

import { eventUrlFor, resolveNotificationContext } from './context.js';
import {
  renderNotificationEmail,
  type EmailPayload,
} from './email-templates.js';
import { dateFor } from './producer.js';
import { escapeHtml } from './templates.js';

/**
 * The waitlist notice for one meetup in one language.
 *
 * The city is named in the reader's language, and French takes it through `cityInputs`, so Le Caire
 * reads "au Caire". The date and the link come from the helpers every other notification uses, so
 * this message cannot drift from them. A city missing from the geography dataset throws: a code in
 * the sentence would be worse than a notice retried.
 */
const renderWaitlistLaunchEmail = async (
  db: Db,
  event: Event,
  locale: Locale,
): Promise<EmailPayload> => {
  const city = geo.findCity(event.marketCode, event.cityCode);
  if (!city)
    throw new Error(
      `city ${event.marketCode}/${event.cityCode} is not in the geography dataset`,
    );
  const context = await resolveNotificationContext(db, {
    preferred: locale,
    marketCode: event.marketCode,
  });
  const values = {
    ...cityInputs(localizedName(city, locale)),
    title: event.title,
    venue: event.venue,
    date: dateFor(event.startsAt.toISOString(), context, true),
    url: eventUrlFor({
      locale,
      marketSlug: context.marketSlug,
      eventSlug: event.slug,
    }),
  };
  const escaped = {
    ...values,
    city: escapeHtml(values.city),
    cityAfterArticle: escapeHtml(values.cityAfterArticle),
    title: escapeHtml(values.title),
    venue: escapeHtml(values.venue),
    date: escapeHtml(values.date),
    url: escapeHtml(values.url),
  };
  const options = { locale };
  return renderNotificationEmail(
    locale,
    ntf_email_waitlist_launch_subject(values, options),
    ntf_email_waitlist_launch_html(escaped, options),
    ntf_email_waitlist_launch_text(values, options),
  );
};

/**
 * The notice a city waitlist promises, for one meetup, rendered at most once per language.
 *
 * Nothing in it is personal, so every entry waiting for the city receives the same message in its
 * language: a round renders it once per language and reads the market once per language, rather
 * than once per recipient. The cache lives as long as the returned function, one invocation.
 */
export const waitlistLaunchEmails = (
  db: Db,
  event: Event,
): ((locale: Locale) => Promise<EmailPayload>) => {
  const rendered = new Map<Locale, Promise<EmailPayload>>();
  return (locale) => {
    const cached = rendered.get(locale);
    if (cached) return cached;
    const email = renderWaitlistLaunchEmail(db, event, locale);
    rendered.set(locale, email);
    return email;
  };
};
