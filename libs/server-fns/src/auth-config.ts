import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

import { configuredSocialProviders, type AuthEnv } from '@founders-coffee/auth';

/**
 * Public auth config for the client: the Turnstile sitekey (safe to expose — it's in the page HTML)
 * and which OAuth providers are configured, one sign-in button each. OAuth secrets stay
 * server-side; only the providers' names cross the wire.
 */
export const getPublicAuthConfig = createServerFn({ strict: false }).handler(
  async () => {
    const e = env as AuthEnv & {
      APP_ENVIRONMENT?: string;
      TURNSTILE_SITE_KEY?: string;
    };
    return {
      turnstileSiteKey: e.TURNSTILE_SITE_KEY ?? null,
      isTurnstileBypassed:
        e.APP_ENVIRONMENT === 'development' && e.TURNSTILE_DISABLED === 'true',
      socialProviders: configuredSocialProviders(e),
    };
  },
);
