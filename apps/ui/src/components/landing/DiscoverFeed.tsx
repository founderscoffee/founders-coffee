import type { Market } from '@founders-coffee/db';
import { cities_in, no_events_yet, type Locale } from '@founders-coffee/i18n';
import type { EventFeedItem, EventFeedPage } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../../features/events/hooks';
import { useEventPages } from '../../features/events/useEventPages';
import { LoadMoreEvents } from '../events/LoadMoreEvents';
import { EventCard } from '../events/EventCard';
import { EmptyState } from './EmptyState';

const PAGE_SIZE = 20;

type DiscoverFeedProps = {
  locale: Locale;
  market: Market;
  events: readonly EventFeedItem[];
  afterStartsAt?: number;
  afterId?: string;
  nextPageHref?: string;
  nextCursor?: EventFeedPage['nextCursor'];
};

export const DiscoverFeed = ({
  locale,
  market,
  events,
  afterStartsAt,
  afterId,
  nextPageHref,
  nextCursor,
}: DiscoverFeedProps) => {
  const pagination = useEventPages(
    useUpcomingEvents(
      {
        marketCode: market.code,
        limit: PAGE_SIZE,
        afterStartsAt,
        afterId,
      },
      {
        initialPage: { items: events, nextCursor: nextCursor ?? null },
      },
    ),
    events,
  );
  const items = pagination.items;
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

  return (
    <section className="mx-auto max-w-content px-4 pb-16 pt-8 md:px-8">
      {items.length > 0 ? (
        <>
          <h2
            id="market-events-title"
            className="mb-8 font-display text-h3 font-semibold tracking-tight text-balance md:mb-10 md:text-h2"
          >
            {cities_in({ market: marketName }, { locale })}
          </h2>
          <ul
            aria-labelledby="market-events-title"
            className="grid grid-cols-1 gap-3.5"
          >
            {items.map((event) => (
              <li key={event.id}>
                <EventCard
                  event={event}
                  locale={locale}
                  timezone={market.timezone}
                  marketSlug={market.slug}
                />
              </li>
            ))}
          </ul>

          <LoadMoreEvents
            locale={locale}
            pagination={pagination}
            nextPageHref={nextPageHref}
          />
        </>
      ) : (
        <EmptyState title={no_events_yet({}, { locale })} />
      )}
    </section>
  );
};
