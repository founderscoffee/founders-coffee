import { describe, expect, it } from 'vitest';

import { AppError } from '@founders-coffee/core';
import { locales, type Locale } from '@founders-coffee/i18n';

import {
  hostPublishFailure,
  REAUTHENTICATION_ERROR_CODE,
} from './host-create-errors';

const CREATE_PATH_ERROR_CODES = [
  'unauthenticated',
  'forbidden',
  'rate_limited',
  'security_configuration_error',
  'validation_failed',
  'event_market_unavailable',
  'event_creation_disabled',
  'map_city_not_found',
  'map_venue_outside_city',
  'map_venue_unsupported',
  'map_provider_unavailable',
  'event_route_conflict',
] as const;

const ALL_LOCALES = locales as readonly Locale[];

const messageFor = (code: string, locale: Locale): string =>
  hostPublishFailure(new AppError(code, 'server detail'), locale).message;

describe('hostPublishFailure', () => {
  it.each(ALL_LOCALES)('answers every create-path code in %s', (locale) => {
    const generic = messageFor('brand_new_server_code', locale);
    for (const code of CREATE_PATH_ERROR_CODES) {
      const message = messageFor(code, locale);
      expect(message.trim(), `${code} is empty in ${locale}`).not.toBe('');
      expect(message, `${code} is unmapped in ${locale}`).not.toBe(generic);
    }
  });

  it('renders a different translation of one code per locale', () => {
    const rendered = ALL_LOCALES.map((locale) =>
      messageFor('rate_limited', locale),
    );
    expect(new Set(rendered).size).toBe(ALL_LOCALES.length);
  });

  it('never leaks the server message detail to the host', () => {
    for (const locale of ALL_LOCALES) {
      for (const code of CREATE_PATH_ERROR_CODES) {
        expect(messageFor(code, locale)).not.toContain('server detail');
      }
    }
  });

  it('falls back to the generic retry message for an unknown code', () => {
    expect(messageFor('something_new', 'en')).toBe(
      "Couldn't publish. Try again.",
    );
    expect(hostPublishFailure(new Error('boom'), 'en').message).toBe(
      "Couldn't publish. Try again.",
    );
  });

  it('reports the stable code alongside the message', () => {
    expect(
      hostPublishFailure(new AppError('rate_limited', 'x'), 'en'),
    ).toMatchObject({ code: 'rate_limited' });
  });

  it('flags an expired session, and only an expired session, for re-authentication', () => {
    for (const code of CREATE_PATH_ERROR_CODES) {
      expect(
        hostPublishFailure(new AppError(code, 'x'), 'en')
          .requiresReauthentication,
        code,
      ).toBe(code === REAUTHENTICATION_ERROR_CODE);
    }
    expect(
      hostPublishFailure(new Error('boom'), 'en').requiresReauthentication,
    ).toBe(false);
  });
});
