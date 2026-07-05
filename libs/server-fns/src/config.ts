import { createServerFn } from '@tanstack/react-start';
import { env } from 'cloudflare:workers';

/**
 * Public app config for the client. `getMapboxToken` exposes the public Mapbox token (safe to
 * expose — Mapbox tokens are designed for client-side use; it lives in the page anyway). Mirrors the
 * `getPublicAuthConfig` public-config-to-client pattern: `cloudflare:workers` is imported inside the
 * handler, so TanStack's createServerFn split drops it from the browser bundle.
 */
export const getMapboxToken = createServerFn({ strict: false }).handler(
  async () => (env as { MAPBOX_TOKEN?: string }).MAPBOX_TOKEN ?? '',
);
