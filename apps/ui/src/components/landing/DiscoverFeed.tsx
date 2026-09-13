import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import {
  host_in_market,
  no_events_yet,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';
import { LogoSymbol } from '@founders-coffee/ui';

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
};

export const DiscoverFeed = ({
  locale,
  market,
  events,
  afterStartsAt,
  afterId,
  nextPageHref,
}: DiscoverFeedProps) => {
  const pagination = useEventPages(
    useUpcomingEvents({
      marketCode: market.code,
      limit: PAGE_SIZE,
      afterStartsAt,
      afterId,
    }),
    events,
  );
  const items = pagination.items;
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

  return (
    <section className="mx-auto max-w-content px-4 pb-16 pt-8 md:px-8">
      {items.length > 0 ? (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3.5">
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
            <li className="hidden md:block">
              <Link
                to="/$market/host/create"
                params={{ market: market.slug }}
                className="flex h-full items-center justify-center gap-3 rounded-box border border-dashed border-base-300 p-3.5 text-body-sm font-medium text-neutral transition-colors hover:border-secondary hover:text-base-content"
              >
                <LogoSymbol size={22} tone="muted" />
                {host_in_market({ market: marketName }, { locale })}
              </Link>
            </li>
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

      <Link
        to="/$market/host/create"
        params={{ market: market.slug }}
        className="btn btn-secondary mt-6 w-full md:hidden"
      >
        {host_in_market({ market: marketName }, { locale })}
      </Link>
    </section>
  );
};
