import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import {
  discover_events,
  discover_workshops,
  host_in_market,
  load_more,
  no_events_yet,
  no_filter_match,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';
import { LogoSymbol } from '@founders-coffee/ui';

import { useUpcomingEvents } from '../../features/events/hooks';
import { EventCard } from '../events/EventCard';
import { EmptyState } from './EmptyState';

const PAGE_SIZE = 20;

const TABS = [
  { key: 'events' as const, label: discover_events },
  { key: 'workshops' as const, label: discover_workshops },
];

type DiscoverFeedProps = {
  locale: Locale;
  market: Market;
  events: readonly EventFeedItem[];
};

export const DiscoverFeed = ({ locale, market, events }: DiscoverFeedProps) => {
  const [tab, setTab] = useState<'events' | 'workshops'>('events');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUpcomingEvents({ marketCode: market.code, limit: PAGE_SIZE });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? events,
    [data, events],
  );
  const counts = useMemo(
    () => ({
      events: items.length,
      workshops: items.filter((e) => e.category === 'workshop').length,
    }),
    [items],
  );
  const visible = useMemo(
    () =>
      tab === 'workshops'
        ? items.filter((e) => e.category === 'workshop')
        : items,
    [tab, items],
  );

  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

  return (
    <section className="mx-auto max-w-content px-4 pb-16 pt-8 md:px-8">
      <div role="tablist" className="mb-5 flex border-b border-base-300">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`-mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-body-sm font-medium transition-colors ${
              tab === key
                ? 'border-b-2 border-primary text-base-content'
                : 'text-neutral hover:text-base-content'
            }`}
            onClick={() => setTab(key)}
          >
            {label({}, { locale })}
            <span className="font-normal text-neutral">{counts[key]}</span>
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-3.5">
            {visible.map((event) => (
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

          {hasNextPage ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <span
                    className="loading loading-spinner loading-xs"
                    aria-hidden="true"
                  />
                ) : null}
                {load_more({}, { locale })}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title={
            tab === 'workshops'
              ? no_filter_match({}, { locale })
              : no_events_yet({}, { locale })
          }
        />
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
