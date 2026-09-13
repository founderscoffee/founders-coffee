import { createFileRoute } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import {
  getPublicEventFeed,
  publicEventFeedRequestSchema,
} from '@founders-coffee/server-fns';

import { NO_INDEX_VALUE, PRODUCTION_ORIGIN } from '../lib/indexation';
import {
  publicEventFeedJson,
  type PublicEventFeedPage,
} from '../lib/public-event-feed';

const jsonHeaders = (production: boolean, cacheable = true): HeadersInit => ({
  'cache-control':
    production && cacheable ? 'public, max-age=60, s-maxage=300' : 'no-store',
  'content-type': 'application/json; charset=utf-8',
  ...(production ? {} : { 'x-robots-tag': NO_INDEX_VALUE }),
});

const errorResponse = (production: boolean, status: number): Response =>
  new Response(
    JSON.stringify({
      error: status === 400 ? 'invalid_request' : 'feed_unavailable',
    }),
    { status, headers: jsonHeaders(production, false) },
  );

const emptyPage: PublicEventFeedPage = { items: [], nextCursor: null };

const publicEventFeedResponse = async (request: Request): Promise<Response> => {
  const origin = new URL(request.url).origin;
  const production = origin === PRODUCTION_ORIGIN;
  if (!production) {
    return new Response(publicEventFeedJson(origin, emptyPage), {
      headers: jsonHeaders(false),
    });
  }
  const search = new URL(request.url).searchParams;
  const parsed = publicEventFeedRequestSchema.safeParse({
    market: search.get('market') ?? undefined,
    cursor: search.get('cursor') ?? undefined,
    limit: search.get('limit') ?? undefined,
  });
  if (!parsed.success) return errorResponse(true, 400);
  try {
    const page = await getPublicEventFeed({ data: parsed.data });
    return new Response(publicEventFeedJson(PRODUCTION_ORIGIN, page), {
      headers: jsonHeaders(true),
    });
  } catch (error) {
    return errorResponse(
      true,
      appErrorCode(error) === 'validation_failed' ? 400 : 503,
    );
  }
};

export const Route = createFileRoute('/events.json')({
  server: {
    handlers: {
      GET: ({ request }) => publicEventFeedResponse(request),
    },
  },
});
