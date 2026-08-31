import { env } from 'cloudflare:workers';

import {
  createAuth,
  getSession,
  type AuthEnv,
  type AuthSession,
} from '@founders-coffee/auth';

/**
 * Narrow the Workers env to the auth factory's shape (DB + BETTER_AUTH_SECRET + APP_URL + optional
 * OAuth/Turnstile). Same single-site narrowing pattern as `getDb` — the lib has no runtime wrangler.
 * Every consuming app MUST provide these (apps/ui via wrangler `vars` + `.dev.vars`).
 */
export const getAuthEnv = (): AuthEnv => env as AuthEnv;

/**
 * Resolve the request's session — construct auth **per request** (never a module singleton — the
 * #5323 D1 write-lock trap), then read the session from the headers. Pure logic (no `@tanstack/…/server`
 * import), so it is directly testable in the Workers pool without the vite-plugin virtual modules.
 * `authMiddleware` ([auth-middleware.ts](./auth-middleware.ts)) wraps this with the request read.
 */
export const resolveSession = async (
  headers: Headers,
): Promise<AuthSession | null> => {
  const { auth } = createAuth(getAuthEnv());
  return getSession(auth, headers);
};
