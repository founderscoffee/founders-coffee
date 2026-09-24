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
import { handleTelegramWebhook } from '@founders-coffee/server-fns/telegram-webhook';
import type { ResponseLinkHeaderEntry } from '@tanstack/react-start/server';
export { RateLimiterDO } from '@founders-coffee/server-fns/rate-limiter-do';

import { createOtpEmailProvider } from './lib/auth-email.js';
import {
  PRIVATE_DOCUMENT_CACHE_CONTROL,
  robotsBody,
  siteOriginFromEnv,
  withPrivateRouteHeaders,
  withIndexationHeaders,
} from './lib/indexation.js';
import {
  isCacheSafeEarlyHint,
  removeEarlyHintsFromResponse,
  shouldEmitEarlyHints,
} from './lib/early-hints.js';
import {
  LIVE_PLACEMENT_PROBE_PATH,
  probeLivePlacement,
  servesPlacementProbe,
} from './lib/live-placement-probe.js';

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
 * Keep failures out of the shared cache.
 *
 * `__root.tsx` asks for `no-store` when a match reports an error, but that only catches some of
 * them: in production a `notFound()` thrown from a loader (`/ar/algeria/not-a-real-city`) and a
 * rejected search parameter both answered with the public `s-maxage=60`, so a single crawler could
 * pin a 404 or a 500 at the edge for every later visitor, while only the global 404 got `no-store`.
 * Status is the one signal every response here carries — documents, assets, server functions and
 * the auth handler alike — so the guard belongs at the entry rather than in the router. It is a
 * floor, not an override: a route that already answered `no-store` keeps the exact value it chose,
 * because `/events.json` publishes its own.
 */
const withoutErrorCaching = (response: Response): Response => {
  const cacheControl = response.headers.get('Cache-Control');
  if (response.status < 400 || cacheControl?.includes('no-store'))
    return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', PRIVATE_DOCUMENT_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

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

/**
 * The live room for one meetup.
 *
 * The location hint counts only the first time a room is reached: Cloudflare places the object
 * then, and every later `get()` for it ignores the hint (#88). A change to
 * `DURABLE_OBJECT_LOCATION_HINT` therefore moves only rooms that do not exist yet.
 */
const liveRoomStub = (env: UiEnv, eventId: string): DurableObjectStub =>
  env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(`event:${eventId}`), {
    locationHint: DURABLE_OBJECT_LOCATION_HINT,
  });

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
      withoutErrorCaching(
        withIndexationHeaders(
          withSecurityHeaders(response, {
            enforceCsp: env.CSP_ENFORCED === 'true',
            reportPath: CSP_REPORT_PATH,
            nonce,
          }),
          env,
        ),
      );

    if (url.pathname === CSP_REPORT_PATH && request.method === 'POST') {
      const report = await request.json().catch(() => null);
      if (report) logger.warn('csp.violation', { report });
      return secure(new Response(null, { status: 204 }));
    }

    if (
      url.pathname === '/robots.txt' &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      const headers = { 'content-type': 'text/plain; charset=utf-8' };
      const body = robotsBody(env);
      return secure(
        request.method === 'HEAD'
          ? new Response(null, { headers })
          : new Response(body, { headers }),
      );
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

      return secure(await liveRoomStub(env, eventId).fetch(request));
    }

    if (
      url.pathname === LIVE_PLACEMENT_PROBE_PATH &&
      request.method === 'GET' &&
      servesPlacementProbe(env)
    )
      return secure(await probeLivePlacement(request, env));

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

    const telegram = handleTelegramWebhook(request, url);
    if (telegram) return secure(await telegram);

    if (url.pathname.startsWith('/api/auth/'))
      return secure(await authHandler(env)(request));
    return runWithContext(
      {
        cspNonce: nonce,
        requestPath: url.pathname,
        siteOrigin: siteOriginFromEnv(env, url.origin),
      },
      async () => {
        const requestOptions = shouldEmitEarlyHints(request, url.pathname)
          ? {
              responseLinkHeader: {
                filter: (entry: ResponseLinkHeaderEntry) =>
                  isCacheSafeEarlyHint(entry, url.origin),
              },
            }
          : undefined;
        const response = await handler.fetch(request, requestOptions);
        return secure(
          withPrivateRouteHeaders(
            removeEarlyHintsFromResponse(response),
            url.pathname,
          ),
        );
      },
    );
  },
} satisfies ExportedHandler<UiEnv>;
