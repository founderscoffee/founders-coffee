import { createServerFn } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';

/**
 * Resolve the visitor's ISO country code for geo-routing. Prod reads the Cloudflare edge header
 * `CF-IPCountry`; dev (Miniflare doesn't set it) falls back to the `DEV_GEO` env var so the redirect
 * is browser-testable locally. Returns `null` if neither is present.
 *
 * Client-safe: the `getRequestHeader` + `cloudflare:workers` imports are inside the handler (server),
 * so TanStack's createServerFn split drops them from the browser bundle.
 */
export const getGeoCountry = createServerFn({ strict: false }).handler(async () => {
  const header = getRequestHeader('cf-ipcountry');
  if (header) return header;
  return (env as { DEV_GEO?: string }).DEV_GEO ?? null;
});
