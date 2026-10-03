import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { createAuthHandler, type HandlerEnv } from '@founders-coffee/auth';
import { createCspNonce, withSecurityHeaders } from '@founders-coffee/core';
import { createCloudflareEmailProvider } from '@founders-coffee/email';
import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';
import { strippingQueryValues } from '@founders-coffee/observability';
import { runWithContext } from '@founders-coffee/observability/context';
import { handleChatSocketRequest } from '@founders-coffee/server-fns/chat-socket';
import { handleClientLogsRequest } from '@founders-coffee/server-fns/client-logs-http';
import {
  CSP_REPORT_PATH,
  handleCspReportRequest,
} from '@founders-coffee/server-fns/csp-report-http';
import { handleProfilePhotoRequest } from '@founders-coffee/server-fns/profile-photo-http';
import { allowSignInCode } from '@founders-coffee/server-fns/sign-in-code-limit';
import type { ResponseLinkHeaderEntry } from '@tanstack/react-start/server';
export { EventChatDO } from '@founders-coffee/server-fns/chat-room';
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
import { withoutRedirectCaching } from './lib/redirect-caching.js';
import { liveRoomEventId } from './durable-objects/event-live/path.js';

export { EventLiveDO } from './durable-objects/EventLiveDO';

export interface UiEnv extends HandlerEnv {
  EMAIL: SendEmail;
  MAIL_FROM: string;
  EVENT_LIVE: DurableObjectNamespace;
  EVENT_CHAT: DurableObjectNamespace;
  CSP_ENFORCED?: string;
  APP_ENVIRONMENT?: string;
  OTP_ECHO?: string;
}

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
 *
 * Every environment, localhost included, limits the sign-in codes a sender and a mailbox can draw
 * through `allowSignInCode`, so the limit a member meets is the one the tests run against.
 */
const authHandler = (env: UiEnv) => {
  const isDev = env.APP_URL.startsWith('http://localhost');
  const emailProvider =
    !isDev && env.EMAIL
      ? createOtpEmailProvider(
          createCloudflareEmailProvider(env.EMAIL, env.MAIL_FROM),
          env,
        )
      : undefined;
  return createAuthHandler(env, {
    ...(emailProvider ? { emailProvider } : {}),
    codeSendLimit: allowSignInCode,
  });
};

/**
 * The live room for one meetup.
 *
 * Every room is placed under `weur`, in every market, on purpose (#88). Measured from Algeria on
 * 2026-09-24 through Cloudflare's Madrid edge, an awake room answered that edge in a median 20 ms
 * under `weur`, 19.5 ms under `afr` and 39 ms under `me`, on top of the member's own 44 ms round
 * trip to the edge. Africa gains Algeria nothing and the Middle East costs it 20 ms a round trip.
 * Egypt and Saudi Arabia were not measured; a hint of their own needs their figures, not a map.
 *
 * The location hint counts only the first time a room is reached: Cloudflare places the object
 * then, and every later `get()` for it ignores the hint (#88). A change to
 * `DURABLE_OBJECT_LOCATION_HINT` therefore moves only rooms that do not exist yet.
 */
const liveRoomStub = (env: UiEnv, eventId: string): DurableObjectStub =>
  env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(`event:${eventId}`), {
    locationHint: DURABLE_OBJECT_LOCATION_HINT,
  });

/**
 * Hand a browser's WebSocket upgrade to its meetup's live room, and turn anything else away here.
 *
 * Only `GET /api/live/<eventId>` with `Upgrade: websocket` is forwarded, as it came. The room reads
 * its meetup from that path with the same `liveRoomEventId`, so the room reached is always the one
 * for the meetup it checks members against.
 */
const openLiveRoom = async (
  request: Request,
  env: UiEnv,
  pathname: string,
): Promise<Response> => {
  const eventId = liveRoomEventId(pathname);
  if (!eventId) return new Response('Not found', { status: 404 });
  if (request.method !== 'GET')
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET' },
    });
  if (request.headers.get('Upgrade') !== 'websocket')
    return new Response('Expected WebSocket upgrade', { status: 426 });
  return liveRoomStub(env, eventId).fetch(request);
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
  fetch: strippingQueryValues(async (request: Request, env: UiEnv) => {
    const url = new URL(request.url);
    const nonce = createCspNonce();
    const secure = (response: Response): Response =>
      withoutRedirectCaching(
        withoutErrorCaching(
          withIndexationHeaders(
            withSecurityHeaders(response, {
              enforceCsp: env.CSP_ENFORCED === 'true',
              reportPath: CSP_REPORT_PATH,
              nonce,
            }),
            env,
          ),
        ),
      );

    const cspReport = handleCspReportRequest(request, url);
    if (cspReport) return secure(await cspReport);

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

    if (url.pathname.startsWith('/api/live/'))
      return secure(await openLiveRoom(request, env, url.pathname));

    const chatSocket = handleChatSocketRequest(request, url);
    if (chatSocket) return secure(await chatSocket);

    const clientLogs = handleClientLogsRequest(request, url);
    if (clientLogs) return secure(await clientLogs);

    const photo = handleProfilePhotoRequest(request, url);
    if (photo) return secure(await photo);

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
  }),
} satisfies ExportedHandler<UiEnv>;
