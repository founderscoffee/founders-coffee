import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import {
  emailPayloadFor,
  pushPayloadFor,
  smsBodyFor,
  type NotificationTemplateKey,
} from './templates.js';

const VALUES = {
  title: 'Coffee + Code',
  venue: 'Café des Délices',
  date: 'Friday, Jan 15',
  url: 'https://staging.founders.coffee/algeria/e/coffee-code',
};

const KEYS: NotificationTemplateKey[] = [
  'rsvp_confirmation',
  'reminder_72h',
  'reminder_24h',
];

const REMINDERS = ['reminder_72h', 'reminder_24h'] as const;

const ARABIC = /[؀-ۿ]/;

const combos = LOCALES.flatMap((locale) =>
  KEYS.map((key) => [locale, key] as const),
);

describe('notification templates render in every locale', () => {
  it.each(combos)('%s / %s interpolates the sms body', (locale, key) => {
    const body = smsBodyFor(key, VALUES, locale);
    expect(body).toContain(VALUES.title);
    expect(body).toContain(VALUES.url);
    expect(body).not.toContain('{');
  });

  it.each(combos)('%s / %s interpolates the email payload', (locale, key) => {
    const email = emailPayloadFor(key, VALUES, locale);
    for (const part of [email.subject, email.html, email.text]) {
      expect(part).toContain(VALUES.title);
      expect(part).not.toContain('{');
    }
    expect(email.html).toContain(`href="${VALUES.url}"`);
    expect(email.text).toContain(VALUES.url);
  });

  it.each(
    LOCALES.flatMap((locale) => REMINDERS.map((key) => [locale, key] as const)),
  )('%s / %s interpolates the push payload', (locale, key) => {
    const push = pushPayloadFor(key, VALUES, locale);
    expect(push.pushTitle).toContain(VALUES.title);
    expect(push.pushTitle).not.toContain('{');
    expect(push.pushBody).not.toContain('{');
    expect(push.pushBody.trim().length).toBeGreaterThan(0);
  });

  it.each(KEYS)('writes %s in Arabic script for the ar locale', (key) => {
    expect(smsBodyFor(key, VALUES, 'ar')).toMatch(ARABIC);
    expect(emailPayloadFor(key, VALUES, 'ar').subject).toMatch(ARABIC);
  });

  it.each(KEYS)('does not fall back to English for %s in fr', (key) => {
    const fr = smsBodyFor(key, VALUES, 'fr');
    const en = smsBodyFor(key, VALUES, 'en');
    expect(fr).not.toBe(en);
  });

  it('escapes user-authored values in the html variant only', () => {
    const hostile = { ...VALUES, title: '<img src=x onerror="alert(1)">' };
    const email = emailPayloadFor('rsvp_confirmation', hostile, 'en' as Locale);

    expect(email.html).not.toContain('<img');
    expect(email.html).toContain('&lt;img');
    expect(email.text).toContain('<img');
    expect(smsBodyFor('rsvp_confirmation', hostile, 'en')).toContain('<img');
  });
});
