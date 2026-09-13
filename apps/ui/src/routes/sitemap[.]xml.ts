import { createFileRoute } from '@tanstack/react-router';

import { getSitemapData } from '@founders-coffee/server-fns';

import { emptySitemapXml, sitemapItems, sitemapXml } from '../lib/sitemap';
import { PRODUCTION_ORIGIN } from '../lib/indexation';

const sitemapResponse = async (request: Request): Promise<Response> => {
  const origin = new URL(request.url).origin;
  const body =
    origin === PRODUCTION_ORIGIN
      ? sitemapXml(origin, sitemapItems(await getSitemapData()))
      : emptySitemapXml(origin);
  return new Response(body, {
    headers: {
      'cache-control':
        origin === PRODUCTION_ORIGIN
          ? 'public, max-age=300, s-maxage=3600'
          : 'no-store',
      'content-type': 'application/xml; charset=utf-8',
    },
  });
};

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: ({ request }) => sitemapResponse(request),
    },
  },
});
