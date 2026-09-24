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
const telegram = {
  ...base,
  telegramText: 'Tomorrow: Coffee + Code',
  telegramPinnedText: 'Coffee + Code',
};

describe('parseNotificationPayload', () => {
  it.each([
    ['sms', sms],
    ['email', { ...base, ...email }],
    ['push', push],
    ['telegram', telegram],
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

  it('accepts an sms payload carrying no email content, which most now do not', () => {
    const withoutEmail = {
      ...base,
      phoneNumber: sms.phoneNumber,
      smsBody: sms.smsBody,
    };
    expect(parseNotificationPayload('sms', withoutEmail).ok).toBe(true);
  });

  it('accepts a push payload with sms content as sms, which is what the fallback does', () => {
    const primary = { ...push, phoneNumber: '+213600000000', smsBody: 'hi' };
    expect(parseNotificationPayload('sms', primary).ok).toBe(true);
  });

  it('accepts a push payload with email content as email, the fallback with no phone', () => {
    expect(parseNotificationPayload('email', { ...push, ...email }).ok).toBe(
      true,
    );
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

  it('accepts a telegram removal that carries no text, only whom to remove', () => {
    const removal = {
      ...base,
      telegramChatId: -1001234567890,
      telegramUserId: 7000000001,
      telegramInviteLink: 'https://t.me/+abc',
    };
    expect(parseNotificationPayload('telegram', removal).ok).toBe(true);
  });

  it('accepts a telegram departure that names its chat and the links to revoke', () => {
    const departure = {
      ...base,
      telegramChatId: -1001234567890,
      telegramInviteLinks: ['https://t.me/+abc', 'https://t.me/+def'],
    };
    expect(parseNotificationPayload('telegram', departure).ok).toBe(true);
  });

  it.each([
    ['telegramText', { ...telegram, telegramText: '' }],
    [
      'telegramPinnedText',
      { ...telegram, telegramPinnedText: 'x'.repeat(4097) },
    ],
    ['telegramChatId', { ...telegram, telegramChatId: 1.5 }],
    ['telegramUserId', { ...telegram, telegramUserId: -5 }],
    ['telegramInviteLink', { ...telegram, telegramInviteLink: 'not a link' }],
    [
      'telegramInviteLinks',
      { ...telegram, telegramInviteLinks: ['https://t.me/+abc', 'not a link'] },
    ],
  ])('rejects a telegram payload with a bad %s', (field, payload) => {
    const result = parseNotificationPayload('telegram', payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain(field);
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
