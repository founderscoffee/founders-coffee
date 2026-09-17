import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import {
  pushPayloadFor,
  smsBodyFor,
  type NotificationTemplateKey,
} from './templates.js';
import { emailPayloadFor } from './email-templates.js';

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
const HOST_AND_OPERATIONS_KEYS: NotificationTemplateKey[] = [
  'rsvp_received',
  'rsvp_cancelled',
  'closeout_prompt',
  'event_did_not_happen',
  'feedback_invitation',
];
const ALL_KEYS = [...KEYS, ...HOST_AND_OPERATIONS_KEYS];

const ARABIC = /[؀-ۿ]/;

const combos = LOCALES.flatMap((locale) =>
  KEYS.map((key) => [locale, key] as const),
);
const hostAndOperationsCombos = LOCALES.flatMap((locale) =>
  HOST_AND_OPERATIONS_KEYS.map((key) => [locale, key] as const),
);

describe('notification templates render in every locale', () => {
  it.each(combos)('%s / %s interpolates the sms body', (locale, key) => {
    const body = smsBodyFor(key, VALUES, locale);
    expect(body).toContain(VALUES.title);
    expect(body).toContain(VALUES.url);
    expect(body).not.toContain('{');
  });

  it.each(combos)(
    '%s / %s interpolates the email payload',
    async (locale, key) => {
      const email = await emailPayloadFor(key, VALUES, locale);
      for (const part of [email.subject, email.html, email.text]) {
        expect(part).toContain(VALUES.title);
        expect(part).not.toContain('{');
      }
      expect(email.html).toContain(
        'src="https://founders.coffee/branding/pwa-logo.png"',
      );
      expect(email.html).toContain(`href="${VALUES.url}"`);
      expect(email.text).toContain(VALUES.url);
    },
  );

  it.each(hostAndOperationsCombos)(
    '%s / %s interpolates the host or operations email payload',
    async (locale, key) => {
      const email = await emailPayloadFor(key, VALUES, locale);
      for (const part of [email.subject, email.html, email.text]) {
        expect(part).toContain(VALUES.title);
        expect(part).not.toContain('{');
      }
      if (key !== 'event_did_not_happen') {
        expect(email.html).toContain(`href="${VALUES.url}"`);
        expect(email.text).toContain(VALUES.url);
      }
    },
  );

  it.each(
    LOCALES.flatMap((locale) => REMINDERS.map((key) => [locale, key] as const)),
  )('%s / %s interpolates the push payload', (locale, key) => {
    const push = pushPayloadFor(key, VALUES, locale);
    expect(push.pushTitle).toContain(VALUES.title);
    expect(push.pushTitle).not.toContain('{');
    expect(push.pushBody).not.toContain('{');
    expect(push.pushBody.trim().length).toBeGreaterThan(0);
  });

  it.each(hostAndOperationsCombos)(
    '%s / %s interpolates the host or operations push payload',
    (locale, key) => {
      const push = pushPayloadFor(key, VALUES, locale);
      expect(push.pushTitle).toContain(VALUES.title);
      expect(push.pushTitle).not.toContain('{');
      expect(push.pushBody).not.toContain('{');
      expect(push.pushBody.trim().length).toBeGreaterThan(0);
      expect(push.pushUrl).toBe(VALUES.url);
    },
  );

  it.each(ALL_KEYS)(
    'writes %s in Arabic script for the ar locale',
    async (key) => {
      if (!HOST_AND_OPERATIONS_KEYS.includes(key))
        expect(smsBodyFor(key, VALUES, 'ar')).toMatch(ARABIC);
      expect((await emailPayloadFor(key, VALUES, 'ar')).subject).toMatch(
        ARABIC,
      );
    },
  );

  it.each(ALL_KEYS)(
    'does not fall back to English for %s in fr',
    async (key) => {
      if (!HOST_AND_OPERATIONS_KEYS.includes(key)) {
        const fr = smsBodyFor(key, VALUES, 'fr');
        const en = smsBodyFor(key, VALUES, 'en');
        expect(fr).not.toBe(en);
      }
      expect((await emailPayloadFor(key, VALUES, 'fr')).subject).not.toBe(
        (await emailPayloadFor(key, VALUES, 'en')).subject,
      );
    },
  );

  it('escapes user-authored values in the html variant only', async () => {
    const hostile = { ...VALUES, title: '<img src=x onerror="alert(1)">' };
    const email = await emailPayloadFor(
      'rsvp_confirmation',
      hostile,
      'en' as Locale,
    );

    expect(email.html).not.toContain('<img src=x');
    expect(email.html).toContain('&lt;img');
    expect(email.text).toContain('<img');
    expect(smsBodyFor('rsvp_confirmation', hostile, 'en')).toContain('<img');
  });
});
