import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

import { hasSocialProviders, type AuthEnv } from '@founders-coffee/auth';

/**
 * Public auth config for the client: the Turnstile sitekey (safe to expose — it's in the page HTML)
 * and whether any OAuth provider is configured (drives the social-buttons UI). OAuth secrets stay
 * server-side; only the boolean crosses the wire.
 */
export const getPublicAuthConfig = createServerFn({ strict: false }).handler(
  async () => {
    const e = env as AuthEnv & { TURNSTILE_SITE_KEY?: string };
    return {
      turnstileSiteKey: e.TURNSTILE_SITE_KEY ?? null,
      hasSocial: hasSocialProviders(e),
    };
  },
);
