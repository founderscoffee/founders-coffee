import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { createAuthHandler, type HandlerEnv } from '@founders-coffee/auth';
import { createCspNonce, withSecurityHeaders } from '@founders-coffee/core';
import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';
import {
  ingestClientLogs,
  logger,
  type LogEntry,
} from '@founders-coffee/observability';
import { runWithContext } from '@founders-coffee/observability/context';
import { handleProfilePhotoRequest } from '@founders-coffee/server-fns/profile-photo-http';
export { RateLimiterDO } from '@founders-coffee/server-fns/rate-limiter-do';

import { createOtpEmailProvider } from './lib/auth-email.js';

export { EventLiveDO } from './durable-objects/EventLiveDO';

export interface UiEnv extends HandlerEnv {
  EMAIL: SendEmail;
  MAIL_FROM: string;
  EVENT_LIVE: DurableObjectNamespace;
  CSP_ENFORCED?: string;
  APP_ENVIRONMENT?: string;
  OTP_ECHO?: string;
}

const CSP_REPORT_PATH = '/csp-report';

/**
 * Build the Better Auth handler with the OTP email provider wired (prod). Dev (localhost) keeps the
 * default `DevEmailProvider` so the OTP is visible in the Worker console for the smoke; prod uses the
 * real Cloudflare Email binding. Constructed per request (auth must not be a module singleton).
 */
const authHandler = (env: UiEnv) => {
  const isDev = env.APP_URL.startsWith('http://localhost');
  const emailProvider =
    !isDev && env.EMAIL
      ? createOtpEmailProvider(env.EMAIL, env.MAIL_FROM, env)
      : undefined;
  return createAuthHandler(env, emailProvider ? { emailProvider } : {});
};

export default {
  /**
   * Serve the request, then stamp every response with the security headers (AGENTS.md §10).
   *
   * The wrapper sits at the entry rather than inside the router so it covers documents, assets,
   * server-function responses and the auth handler alike — a header that only lands on some responses
   * is the one an attacker uses. `CSP_ENFORCED=true` flips report-only to enforced per environment.
   *
   * Each response gets a fresh script nonce, published to the router through the request context so
   * that the same value reaches the header and every inline script TanStack emits. The context is
   * the only channel that is safe here: the router factory takes no request, and a module-level
   * variable would let two requests being served concurrently in one isolate read each other's
   * nonce — which either blocks a legitimate page or, worse, hands a live nonce to another
   * response.
   */
  fetch: async (request: Request, env: UiEnv): Promise<Response> => {
    const url = new URL(request.url);
    const nonce = createCspNonce();
    const secure = (response: Response): Response =>
      withSecurityHeaders(response, {
        enforceCsp: env.CSP_ENFORCED === 'true',
        reportPath: CSP_REPORT_PATH,
        nonce,
      });

    if (url.pathname === CSP_REPORT_PATH && request.method === 'POST') {
      const report = await request.json().catch(() => null);
      if (report) logger.warn('csp.violation', { report });
      return secure(new Response(null, { status: 204 }));
    }

    if (url.pathname.startsWith('/api/live/')) {
      const eventId = url.pathname.split('/api/live/')[1]?.split('/')[0];
      if (!eventId)
        return secure(new Response('Missing event id', { status: 400 }));

      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return secure(
          new Response('Expected WebSocket upgrade', { status: 426 }),
        );
      }

      const doId = env.EVENT_LIVE.idFromName(`event:${eventId}`);
      const doStub = env.EVENT_LIVE.get(doId, {
        locationHint: DURABLE_OBJECT_LOCATION_HINT,
      });
      return secure(await doStub.fetch(request));
    }

    if (url.pathname === '/client-logs' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as {
        entries?: unknown;
      } | null;
      if (body && Array.isArray(body.entries))
        ingestClientLogs(body.entries as LogEntry[]);
      return secure(new Response(null, { status: 204 }));
    }
    const photo = handleProfilePhotoRequest(request, url);
    if (photo) return secure(await photo);

    if (url.pathname.startsWith('/api/auth/'))
      return secure(await authHandler(env)(request));
    return runWithContext({ cspNonce: nonce }, async () =>
      secure(await handler.fetch(request)),
    );
  },
} satisfies ExportedHandler<UiEnv>;
