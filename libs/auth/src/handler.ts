import { createAuth, type AuthDeps, type AuthEnv } from './auth.js';
import {
  DenyTurnstileVerifier,
  DevTurnstileVerifier,
  TurnstileSiteVerifier,
  type TurnstileVerifier,
} from './providers/turnstile.js';

/** Environment the HTTP handler needs (auth env + optional Turnstile). */
export interface HandlerEnv extends AuthEnv {
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_DISABLED?: string;
}

/**
 * Auth endpoints that mutate state / are brute-force surfaces → Turnstile-gated.
 * The client sends the Turnstile token in the `cf-turnstile-response` header
 * (header-based so we don't have to parse/clone the request body).
 */
const TURNSTILE_SUFFIXES = [
  '/send-verification-otp',
  '/sign-in/email-otp',
  '/verify-email',
  '/phone-number/send-otp',
  '/phone-number/verify',
  '/phone-number/request-password-reset',
];

const isTurnstileGated = (pathname: string, method: string): boolean =>
  method === 'POST' &&
  TURNSTILE_SUFFIXES.some((suffix) => pathname.endsWith(suffix));

/**
 * Select the verifier for the gated endpoints. The bypass requires an explicit
 * `TURNSTILE_DISABLED=true`; a merely *absent* secret key denies instead, because these endpoints
 * send SMS and email on the account's bill and an unprotected `/phone-number/send-otp` is an open
 * SMS-pumping relay. Failing closed turns a forgotten secret into a visible outage rather than a
 * silent hole (AGENTS.md §10).
 */
const selectTurnstileVerifier = (env: HandlerEnv): TurnstileVerifier => {
  if (env.TURNSTILE_DISABLED === 'true') return new DevTurnstileVerifier();
  if (!env.TURNSTILE_SECRET_KEY) return new DenyTurnstileVerifier();
  return new TurnstileSiteVerifier(env.TURNSTILE_SECRET_KEY);
};

/**
 * Build the Better Auth HTTP handler for an app, with Turnstile gating on the
 * brute-force endpoints. Construct per request (the handler is cheap; the auth
 * instance inside must not be a module singleton — see createAuth). `deps`
 * forwards to `createAuth` — pass `{ emailProvider }` to wire a real OTP sender
 * (otherwise `createAuth` defaults to the dev console provider).
 */
export const createAuthHandler = (env: HandlerEnv, deps: AuthDeps = {}) => {
  const { auth } = createAuth(env, deps);
  const turnstile: TurnstileVerifier = selectTurnstileVerifier(env);

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (isTurnstileGated(url.pathname, request.method)) {
      const ok = await turnstile.verify(
        request.headers.get('cf-turnstile-response'),
        request.headers.get('cf-connecting-ip') ?? undefined,
      );
      if (!ok) {
        return new Response(JSON.stringify({ error: 'turnstile_failed' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    return auth.handler(request);
  };
};
