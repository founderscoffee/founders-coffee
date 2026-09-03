import { describe, expect, it } from 'vitest';

import { requireEventCreateWaf, resolveTurnstileProvider } from './runtime.js';

describe('Turnstile runtime security configuration', () => {
  it('allows only the explicit development bypass', async () => {
    const development = resolveTurnstileProvider({
      APP_ENVIRONMENT: 'development',
      TURNSTILE_DISABLED: 'true',
    });
    const staging = resolveTurnstileProvider({
      APP_ENVIRONMENT: 'staging',
      TURNSTILE_DISABLED: 'true',
    });

    expect(development.ok).toBe(true);
    if (development.ok) {
      expect(
        (
          await development.data.verify({
            expectedAction: 'join_waitlist',
          })
        ).ok,
      ).toBe(true);
    }
    expect(staging.ok).toBe(false);
    if (!staging.ok) {
      expect(staging.error.code).toBe('security_configuration_error');
    }
  });

  it('fails closed without a secret or valid application URL', () => {
    const missingSecret = resolveTurnstileProvider({
      APP_ENVIRONMENT: 'production',
      APP_URL: 'https://founders.coffee',
    });
    const invalidUrl = resolveTurnstileProvider({
      APP_ENVIRONMENT: 'production',
      APP_URL: 'not-a-url',
      TURNSTILE_SECRET_KEY: 'secret',
    });

    expect(missingSecret.ok).toBe(false);
    expect(invalidUrl.ok).toBe(false);
  });

  it('fails deployed event creation closed until WAF evidence is configured', () => {
    const development = requireEventCreateWaf({
      APP_ENVIRONMENT: 'development',
    });
    const stagingMissing = requireEventCreateWaf({
      APP_ENVIRONMENT: 'staging',
    });
    const productionConfigured = requireEventCreateWaf({
      APP_ENVIRONMENT: 'production',
      EVENT_CREATE_WAF_CONFIGURED: 'true',
    });

    expect(development.ok).toBe(true);
    expect(stagingMissing.ok).toBe(false);
    if (!stagingMissing.ok) {
      expect(stagingMissing.error.code).toBe('security_configuration_error');
    }
    expect(productionConfigured.ok).toBe(true);
  });
});
