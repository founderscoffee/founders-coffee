import { describe, expect, it } from 'vitest';

import {
  EMAIL_RATE_LIMIT_CODES,
  mapEmailProviderCode,
  readEmailProviderCode,
} from './error-codes.js';

describe('mapEmailProviderCode', () => {
  it('maps rate-limit codes to email_rate_limited', () => {
    for (const code of EMAIL_RATE_LIMIT_CODES) {
      expect(mapEmailProviderCode(code)).toBe('email_rate_limited');
    }
  });

  it('maps suppression to email_recipient_suppressed', () => {
    expect(mapEmailProviderCode('E_RECIPIENT_SUPPRESSED')).toBe('email_recipient_suppressed');
  });

  it('maps every other documented Cloudflare code to email_send_failed', () => {
    const others = [
      'E_VALIDATION_ERROR',
      'E_FIELD_MISSING',
      'E_TOO_MANY_RECIPIENTS',
      'E_SENDER_NOT_VERIFIED',
      'E_RECIPIENT_NOT_ALLOWED',
      'E_SENDER_DOMAIN_NOT_AVAILABLE',
      'E_CONTENT_TOO_LARGE',
      'E_DELIVERY_FAILED',
      'E_INTERNAL_SERVER_ERROR',
      'E_HEADER_NOT_ALLOWED',
      'E_HEADER_USE_API_FIELD',
      'E_HEADER_VALUE_INVALID',
    ];
    for (const code of others) {
      expect(mapEmailProviderCode(code)).toBe('email_send_failed');
    }
  });

  it('maps an unknown code to email_send_failed', () => {
    expect(mapEmailProviderCode('E_SOMETHING_NEW')).toBe('email_send_failed');
  });
});

describe('readEmailProviderCode', () => {
  it('reads .code from a thrown Error-like object', () => {
    const error = Object.assign(new Error('boom'), { code: 'E_RATE_LIMIT_EXCEEDED' });
    expect(readEmailProviderCode(error)).toBe('E_RATE_LIMIT_EXCEEDED');
  });

  it('falls back to E_UNKNOWN when no string code is present', () => {
    expect(readEmailProviderCode(new Error('no code'))).toBe('E_UNKNOWN');
    expect(readEmailProviderCode({ code: 42 })).toBe('E_UNKNOWN');
    expect(readEmailProviderCode({})).toBe('E_UNKNOWN');
    expect(readEmailProviderCode(null)).toBe('E_UNKNOWN');
  });
});
