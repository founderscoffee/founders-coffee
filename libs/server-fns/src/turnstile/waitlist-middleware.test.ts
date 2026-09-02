import { describe, expect, it } from 'vitest';

import { appErrorCode } from '@founders-coffee/core';

import { resolveTurnstileProvider } from './runtime.js';

const STAGING = {
  APP_ENVIRONMENT: 'staging',
  APP_URL: 'https://staging.founders.coffee',
};

describe('AR-06 waitlist bot protection fails closed', () => {
  it('refuses to build a provider without a secret outside development', () => {
    const result = resolveTurnstileProvider({ ...STAGING });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('security_configuration_error');
    }
  });

  it('refuses an explicit bypass outside development', () => {
    const result = resolveTurnstileProvider({
      ...STAGING,
      TURNSTILE_DISABLED: 'true',
      TURNSTILE_SECRET_KEY: 'secret',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(appErrorCode(result.error)).toBe('security_configuration_error');
    }
  });

  it('allows the dev provider only in local development', () => {
    const result = resolveTurnstileProvider({
      APP_ENVIRONMENT: 'development',
      TURNSTILE_DISABLED: 'true',
    });
    expect(result.ok).toBe(true);
  });

  it('builds a real provider when the secret is configured', () => {
    const result = resolveTurnstileProvider({
      ...STAGING,
      TURNSTILE_SECRET_KEY: 'secret',
    });
    expect(result.ok).toBe(true);
  });
});
