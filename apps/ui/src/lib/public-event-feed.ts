import type { PublicEventFeedPage } from '@founders-coffee/server-fns';

export type { PublicEventFeedPage } from '@founders-coffee/server-fns';

import { canonicalPath } from './seo';

export type PublicEventFeedItem = PublicEventFeedPage['items'][number] & {
  readonly url: string;
};

export type PublicEventFeedResponse = {
  readonly items: readonly PublicEventFeedItem[];
  readonly nextCursor: string | null;
};

const eventUrl = (
  origin: string,
  event: PublicEventFeedPage['items'][number],
): string =>
  `${origin.replace(/\/$/u, '')}${canonicalPath({
    type: 'event',
    market: event.market,
    slug: event.slug,
    locale: event.language,
  })}`;

export const publicEventFeedResponse = (
  origin: string,
  page: PublicEventFeedPage,
): PublicEventFeedResponse => ({
  items: page.items.map((event) => ({
    ...event,
    url: eventUrl(origin, event),
  })),
  nextCursor: page.nextCursor,
});

export const publicEventFeedJson = (
  origin: string,
  page: PublicEventFeedPage,
): string => JSON.stringify(publicEventFeedResponse(origin, page));
