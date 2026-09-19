import { createFileRoute } from '@tanstack/react-router';

import { getSitemapData } from '@founders-coffee/server-fns';

import { PRODUCTION_ORIGIN, NO_INDEX_VALUE } from '../lib/indexation';
import { llmsText, stagingLlmsText } from '../lib/llms';

const llmsResponse = async (request: Request): Promise<Response> => {
  const origin = new URL(request.url).origin;
  const isProduction = origin === PRODUCTION_ORIGIN;
  const body = isProduction
    ? llmsText(PRODUCTION_ORIGIN, await getSitemapData())
    : stagingLlmsText(origin);
  return new Response(body, {
    headers: {
      'cache-control': isProduction
        ? 'public, max-age=300, s-maxage=3600'
        : 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      ...(isProduction ? {} : { 'x-robots-tag': NO_INDEX_VALUE }),
    },
  });
};

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: ({ request }) => llmsResponse(request),
    },
  },
});
