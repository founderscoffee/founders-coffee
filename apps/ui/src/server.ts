import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { createAuthHandler, type HandlerEnv } from '@founders-coffee/auth';
import {
  ingestClientLogs,
  type LogEntry,
} from '@founders-coffee/observability';
export { RateLimiterDO } from '@founders-coffee/server-fns/rate-limiter-do';

import { createOtpEmailProvider } from './lib/auth-email.js';

export { EventLiveDO } from './durable-objects/EventLiveDO';

export interface UiEnv extends HandlerEnv {
  EMAIL: SendEmail;
  MAIL_FROM: string;
  EVENT_LIVE: DurableObjectNamespace;
}

/**
 * Build the Better Auth handler with the OTP email provider wired (prod). Dev (localhost) keeps the
 * default `DevEmailProvider` so the OTP is visible in the Worker console for the smoke; prod uses the
 * real Cloudflare Email binding. Constructed per request (auth must not be a module singleton).
 */
const authHandler = (env: UiEnv) => {
  const isDev = env.APP_URL.startsWith('http://localhost');
  const emailProvider =
    !isDev && env.EMAIL
      ? createOtpEmailProvider(env.EMAIL, env.MAIL_FROM)
      : undefined;
  return createAuthHandler(env, emailProvider ? { emailProvider } : {});
};

export default {
  fetch: async (request: Request, env: UiEnv): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/live/')) {
      const eventId = url.pathname.split('/api/live/')[1]?.split('/')[0];
      if (!eventId) return new Response('Missing event id', { status: 400 });

      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 });
      }

      const doId = env.EVENT_LIVE.idFromName(`event:${eventId}`);
      const doStub = env.EVENT_LIVE.get(doId);
      return doStub.fetch(request);
    }

    if (url.pathname === '/client-logs' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as {
        entries?: unknown;
      } | null;
      if (body && Array.isArray(body.entries))
        ingestClientLogs(body.entries as LogEntry[]);
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith('/api/auth/')) return authHandler(env)(request);
    return handler.fetch(request);
  },
} satisfies ExportedHandler<UiEnv>;
