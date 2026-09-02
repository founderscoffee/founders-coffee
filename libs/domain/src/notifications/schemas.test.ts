import { describe, expect, it } from 'vitest';

import { parseNotificationPayload } from './schemas.js';

const base = {
  eventTitle: 'Coffee + Code',
  eventSlug: 'coffee-code',
  marketCode: 'DZ',
  startsAt: '2099-01-15T18:00:00.000Z',
  venue: 'Café des Délices',
  locale: 'ar',
};

const email = {
  email: 'member@founders.coffee',
  subject: 'You are in',
  html: '<p>hi</p>',
};

const sms = { ...base, ...email, phoneNumber: '+213600000000', smsBody: 'hi' };
const push = { ...base, pushTitle: 'Reminder', pushBody: 'Tomorrow' };

describe('parseNotificationPayload', () => {
  it.each([
    ['sms', sms],
    ['email', { ...base, ...email }],
    ['push', push],
  ])('accepts a complete %s payload', (channel, payload) => {
    const result = parseNotificationPayload(channel, payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.channel).toBe(channel);
  });

  it('rejects an unknown channel rather than guessing', () => {
    const result = parseNotificationPayload('carrier-pigeon', sms);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('unknown channel');
  });

  it.each([
    ['phoneNumber', { ...sms, phoneNumber: undefined }],
    ['smsBody', { ...sms, smsBody: '' }],
    ['locale', { ...sms, locale: 'de' }],
    ['eventTitle', { ...sms, eventTitle: undefined }],
  ])('rejects an sms payload with a bad %s', (field, payload) => {
    const result = parseNotificationPayload('sms', payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(field);
  });

  it('requires an sms payload to carry the email content its fallback inherits', () => {
    const withoutEmail = { ...sms, subject: undefined, html: undefined };
    const result = parseNotificationPayload('sms', withoutEmail);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('subject');
      expect(result.reason).toContain('html');
    }
  });

  it('accepts an sms payload as an email payload, which is what the fallback does', () => {
    expect(parseNotificationPayload('email', sms).ok).toBe(true);
  });

  it('rejects a push payload missing its body', () => {
    expect(parseNotificationPayload('push', { ...base }).ok).toBe(false);
  });

  it('passes unknown keys through rather than failing on them', () => {
    const result = parseNotificationPayload('push', {
      ...push,
      futureField: 'x',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a non-object payload', () => {
    expect(parseNotificationPayload('sms', null).ok).toBe(false);
    expect(parseNotificationPayload('sms', 'a string').ok).toBe(false);
  });

  it('names every failing field, not just the first', () => {
    const result = parseNotificationPayload('sms', base);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('phoneNumber');
      expect(result.reason).toContain('smsBody');
    }
  });
});
