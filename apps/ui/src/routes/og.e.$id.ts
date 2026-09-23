import { createFileRoute } from '@tanstack/react-router';

import { prefixedId } from '@founders-coffee/core';
import { isLocale, type Locale } from '@founders-coffee/i18n';
import { getEventCardData } from '@founders-coffee/server-fns';

import { eventCardText, eventCardTree } from '../lib/og-card';
import { DEFAULT_SOCIAL_IMAGE_PATH } from '../lib/seo';

const CARD_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400';

const cardUrlParts = (
  request: Request,
): { readonly short: string; readonly locale: Locale } => {
  const url = new URL(request.url);
  const requested = url.searchParams.get('l');
  return {
    short: decodeURIComponent(url.pathname.split('/').pop() ?? ''),
    locale: isLocale(requested) ? requested : 'ar',
  };
};

/**
 * The social card for one meetup, rendered to PNG.
 *
 * A meetup with no card — unknown, unpublished, or one whose render fails — answers a redirect to
 * the site's default image rather than a status code. A scraper that gets a 404 here shows the
 * shared link with no picture at all, and a generic picture is better than none; the page's own
 * `og:title` and `og:description` are event-specific either way.
 *
 * The address carries the event's `version`, which nothing here reads. It is there so that an
 * edited title produces a different URL: without it the card an edited meetup shares would be
 * whatever a scraper cached the first time, for as long as it kept it.
 *
 * The renderer is reached for only once there is something to draw. It carries three WebAssembly
 * modules and four fonts, and a static import puts all of it in the graph every other request
 * pays to evaluate — for a route that answers a scraper a few times a day.
 */
const cardResponse = async (request: Request): Promise<Response> => {
  const { short, locale } = cardUrlParts(request);
  const fallback = Response.redirect(
    new URL(DEFAULT_SOCIAL_IMAGE_PATH, request.url).toString(),
    302,
  );
  if (!short) return fallback;

  try {
    const card = await getEventCardData({
      data: { id: prefixedId('evt', short) },
    });
    if (!card) return fallback;
    const { renderCardPng } = await import('../lib/og-render');
    const png = await renderCardPng(
      eventCardTree(
        eventCardText({
          locale,
          title: card.title,
          startsAt: new Date(card.startsAt),
          timezone: card.timezone,
          city: {
            name: card.cityName,
            nameAr: card.cityNameAr,
            nameFr: card.cityNameFr,
          },
          hostName: card.hostName,
        }),
      ),
    );
    return new Response(png as BodyInit, {
      headers: {
        'content-type': 'image/png',
        'cache-control': CARD_CACHE_CONTROL,
      },
    });
  } catch {
    return fallback;
  }
};

export const Route = createFileRoute('/og/e/$id')({
  server: {
    handlers: {
      GET: ({ request }) => cardResponse(request),
    },
  },
});
