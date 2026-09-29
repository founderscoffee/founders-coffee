import { createAuth, type AuthDeps, type AuthEnv } from './auth.js';
import { isCaptchaGated } from './captcha.js';
import { isPublicAuthRoute } from './routes.js';

export type HandlerEnv = AuthEnv;

/**
 * Build the Better Auth HTTP handler for an app. Construct per request (the handler is cheap; the
 * auth instance inside must not be a module singleton — see createAuth). `deps` forwards to
 * `createAuth` — pass `{ emailProvider }` to wire a real OTP sender (otherwise `createAuth` defaults
 * to the dev console provider).
 *
 * A public handler serves only the routes in `PUBLIC_AUTH_ROUTES` and answers 404 to the rest (see
 * `isPublicAuthRoute`). The internal handler that `captchaBypassed` marks is exempt: a server
 * function builds it per call, after its own permission check, for a request it wrote itself, and
 * the contact changes it makes use routes no browser should reach directly.
 *
 * Turnstile verification itself belongs to the `captcha` plugin registered in `createAuth`, which
 * calls siteverify under a 10-second deadline and rejects a missing or invalid token. This wrapper
 * covers the one case the plugin cannot: when no secret key is configured the plugin is not
 * registered at all, which would leave public endpoints wide open. Refusing them with a 503 makes
 * a forgotten secret a visible outage instead of a silent hole (AGENTS §10). The explicit
 * `captchaBypassed` dependency is reserved for internal authenticated contact operations after
 * their server-function permission check; public handlers cannot set it.
 */
export const createAuthHandler = (env: HandlerEnv, deps: AuthDeps = {}) => {
  const { auth } = createAuth(env, deps);
  const isInternal = deps.captchaBypassed === true;
  const isCaptchaUnconfigured =
    !env.TURNSTILE_SECRET_KEY &&
    env.TURNSTILE_DISABLED !== 'true' &&
    !isInternal;

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (!isInternal && !isPublicAuthRoute(url.pathname, request.method))
      return new Response(null, { status: 404 });
    if (isCaptchaUnconfigured && isCaptchaGated(url.pathname, request.method))
      return new Response(JSON.stringify({ error: 'captcha_unconfigured' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      });
    return auth.handler(request);
  };
};
