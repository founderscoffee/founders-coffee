import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import {
  discover_events,
  discover_workshops,
  no_events_yet,
  no_filter_match,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../../features/events/hooks';
import { EventCard } from '../events/EventCard';
import { EmptyState } from './EmptyState';

const PAGE_SIZE = 20;

const TABS = [
  { key: 'events' as const, label: discover_events },
  { key: 'workshops' as const, label: discover_workshops },
];
const ITEM_HEIGHT = 104;

type DiscoverFeedProps = {
  locale: Locale;
  market: Market;
  events: readonly EventFeedItem[];
};

export const DiscoverFeed = ({ locale, market, events }: DiscoverFeedProps) => {
  const [tab, setTab] = useState<'events' | 'workshops'>('events');
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUpcomingEvents({
      marketCode: market.code,
      limit: PAGE_SIZE,
    });

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? events,
    [data, events],
  );
  const visible = useMemo(
    () =>
      tab === 'workshops'
        ? items.filter((e) => e.category === 'workshop')
        : items,
    [tab, items],
  );

  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !hasNextPage || isFetchingNextPage) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) void fetchNextPage();
        },
        { rootMargin: '200px' },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  return (
    <section className="mx-auto max-w-5xl px-4 pb-16">
      <div role="tablist" className="mb-6 flex border-b border-base-300">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`-mb-px px-3.5 py-2.5 text-body-sm font-medium transition-colors ${
              tab === key
                ? 'border-b-2 border-primary text-base-content'
                : 'text-neutral hover:text-base-content'
            }`}
            onClick={() => setTab(key)}
          >
            {label({}, { locale })}
          </button>
        ))}
      </div>
      {visible.length > 0 ? (
        <div ref={scrollRef} className="relative max-h-[800px] overflow-auto">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const event = visible[virtualRow.index];
              const isLast = virtualRow.index === visible.length - 1;
              return (
                <div
                  key={event.id}
                  ref={isLast ? lastItemRef : undefined}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="mb-4"
                >
                  <EventCard
                    event={event}
                    locale={locale}
                    timezone={market.timezone}
                    marketSlug={market.slug}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          title={
            tab === 'workshops'
              ? no_filter_match({}, { locale })
              : no_events_yet({}, { locale })
          }
        />
      )}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <span className="loading loading-dots loading-md" />
        </div>
      )}
    </section>
  );
};
