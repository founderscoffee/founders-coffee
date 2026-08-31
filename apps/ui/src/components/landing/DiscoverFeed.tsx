import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef, useState } from 'react';

import type { Market } from '@founders-coffee/db';
import {
  discover_events,
  discover_workshops,
  no_events_yet,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../../features/events/hooks';
import { EventCard } from '../events/EventCard';

const PAGE_SIZE = 20;
const ITEM_HEIGHT = 120;

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
      <div role="tablist" className="tabs tabs-lift mb-6">
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'events' ? 'tab-active' : ''}`}
          onClick={() => setTab('events')}
        >
          {discover_events({}, { locale })}
        </button>
        <button
          type="button"
          role="tab"
          className={`tab ${tab === 'workshops' ? 'tab-active' : ''}`}
          onClick={() => setTab('workshops')}
        >
          {discover_workshops({}, { locale })}
        </button>
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
        <p className="py-12 text-center text-base-content/40">
          {no_events_yet({}, { locale })}
        </p>
      )}
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <span className="loading loading-dots loading-md" />
        </div>
      )}
    </section>
  );
};
