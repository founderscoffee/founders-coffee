import { createAuth, type AuthDeps, type AuthEnv } from './auth.js';
import { isCaptchaGated } from './captcha.js';

/** Environment the HTTP handler needs. Identical to {@link AuthEnv}. */
export type HandlerEnv = AuthEnv;

/**
 * Build the Better Auth HTTP handler for an app. Construct per request (the handler is cheap; the
 * auth instance inside must not be a module singleton — see createAuth). `deps` forwards to
 * `createAuth` — pass `{ emailProvider }` to wire a real OTP sender (otherwise `createAuth` defaults
 * to the dev console provider).
 *
 * Turnstile verification itself belongs to the `captcha` plugin registered in `createAuth`, which
 * calls siteverify under a 10-second deadline and rejects a missing or invalid token. This wrapper
 * covers the one case the plugin cannot: when no secret key is configured the plugin is not
 * registered at all, which would leave the money-spending endpoints wide open. Refusing them with a
 * 503 makes a forgotten secret a visible outage instead of a silent hole (AGENTS §10). The only
 * bypass is an explicit `TURNSTILE_DISABLED=true`, for local dev.
 */
export const createAuthHandler = (env: HandlerEnv, deps: AuthDeps = {}) => {
  const { auth } = createAuth(env, deps);
  const isCaptchaUnconfigured =
    !env.TURNSTILE_SECRET_KEY && env.TURNSTILE_DISABLED !== 'true';

  return async (request: Request): Promise<Response> => {
    if (isCaptchaUnconfigured) {
      const url = new URL(request.url);
      if (isCaptchaGated(url.pathname, request.method)) {
        return new Response(JSON.stringify({ error: 'captcha_unconfigured' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return auth.handler(request);
  };
};
