import type { BetterAuthPlugin } from 'better-auth';

import { reportError } from '@founders-coffee/observability';

import { AUTH_BASE_PATH } from './routes.js';

export interface CodeSendRequest {
  readonly recipient: string;
  readonly address: string;
}

export type CodeSendLimit = (request: CodeSendRequest) => Promise<boolean>;

const CODE_SEND_PATH = `${AUTH_BASE_PATH}/email-otp/send-verification-otp`;

/** A JSON answer Better Auth's router returns as it is, without running the endpoint. */
const refusal = (status: 429 | 503, code: string, message: string) => ({
  response: new Response(JSON.stringify({ code, message }), {
    status,
    headers: { 'content-type': 'application/json' },
  }),
});

/**
 * The address a code request names, or `null` when its body names none.
 *
 * The body is read from a copy, so Better Auth still reads the original. A body that is not JSON,
 * or that names no address, is left for Better Auth's own validation to refuse, so one parser
 * decides what a valid request is.
 */
const recipientOf = async (request: Request): Promise<string | null> => {
  try {
    const body: unknown = await request.clone().json();
    const email = (body as { email?: unknown } | null)?.email;
    return typeof email === 'string' && email.length > 0 ? email : null;
  } catch {
    return null;
  }
};

/**
 * A Better Auth plugin that asks `allows` before a sign-in code is mailed, and answers 429 when it
 * says no.
 *
 * It runs in `onRequest`, listed after the captcha plugin. Better Auth calls each plugin's
 * `onRequest` in the order the plugins are listed, before the endpoint runs, so a request reaches
 * this one only once Turnstile has accepted it. That order is the point. A budget spent before the
 * captcha check could be emptied for any address by anyone, without solving a challenge, and a
 * stranger could keep a member from signing in. Here every request that spends it has cost a
 * solved challenge, and a refused request never reaches the endpoint, so the code already waiting
 * in the member's inbox stays the one that works.
 *
 * A refusal is returned, never thrown. Better Auth's router hands a returned response back as it
 * is, while an error thrown inside it surfaces as an unhandled rejection under the Workers test
 * pool. When the limiter itself fails, the code is not sent and the answer is a 503, so a missing
 * Durable Object binding closes the route rather than leaving it unlimited (AGENTS §10).
 *
 * Without `allows` it does nothing. The internal handler a contact change builds draws on that
 * change's own per-member budget, and the admin app pins every code to the address Access verified.
 */
export const codeSendLimit = (allows?: CodeSendLimit) =>
  ({
    id: 'code-send-limit',
    onRequest: async (request: Request) => {
      if (!allows || request.method !== 'POST') return undefined;
      if (new URL(request.url).pathname !== CODE_SEND_PATH) return undefined;
      const recipient = await recipientOf(request);
      if (recipient === null) return undefined;
      const address = request.headers.get('cf-connecting-ip') ?? 'unknown';
      try {
        if (await allows({ recipient, address })) return undefined;
        return refusal(
          429,
          'TOO_MANY_CODES',
          'Too many codes were asked for. Try again later.',
        );
      } catch (error) {
        reportError(error, { action: 'sign_in_code_limit' });
        return refusal(
          503,
          'CODE_LIMIT_UNAVAILABLE',
          'A code cannot be sent right now.',
        );
      }
    },
  }) satisfies BetterAuthPlugin;
