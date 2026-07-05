import { Link } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  cities_in,
  discover_events,
  discover_workshops,
  hero_adjacent_cities,
  hero_empty_city,
  hero_empty_cta,
  hero_empty_subtitle,
  hero_popular_cities,
  hero_search_cta,
  hero_search_no_match,
  hero_search_placeholder,
  hero_social_proof,
  hero_subtitle,
  hero_tagline,
  hero_waitlist_prompt,
  no_events_yet,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../features/events/hooks';
import { WaitlistForm } from '../features/waitlist/components/WaitlistForm';
import { CitySearchCombobox } from './CitySearchCombobox';
import { EventCard } from './EventCard';

type MarketLandingProps = {
  locale: Locale;
  market: Market;
  cities: readonly geo.GeoCity[];
  /** Upcoming event counts per city code (drives the city-badge counts + active styling). */
  cityEventCounts: Record<string, number>;
  /** First page of the market-wide Discover feed (subsequent pages via "Load more"). */
  events: readonly EventFeedItem[];
};

const PAGE_SIZE = 20;
const ITEM_HEIGHT = 120;

export const MarketLanding = ({
  locale,
  market,
  cities,
  cityEventCounts,
  events,
}: MarketLandingProps) => {
  const [tab, setTab] = useState<'events' | 'workshops'>('events');
  const [selectedCityCode, setSelectedCityCode] = useState('');
  const [showWaitlist, setShowWaitlist] = useState(false);
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
          if (entries[0]?.isIntersecting) {
            fetchNextPage();
          }
        },
        { rootMargin: '200px' },
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  const selectedCity = useMemo(
    () =>
      selectedCityCode
        ? cities.find((c) => c.code === selectedCityCode)
        : undefined,
    [selectedCityCode, cities],
  );

  const selectedCityCount = selectedCity
    ? (cityEventCounts[selectedCity.code] ?? 0)
    : 0;
  const isSelectedCityEmpty =
    selectedCity !== undefined && selectedCityCount === 0;
  const cityDisplayName = selectedCity
    ? locale === 'ar'
      ? selectedCity.nameAr
      : selectedCity.name
    : '';

  return (
    <>
      <section className="relative overflow-hidden pb-12 pt-8 md:pt-12 mx-auto text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-[600px] max-w-5xl"
        >
          <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute left-1/2 top-12 h-[400px] w-[550px] -translate-x-1/2 rounded-full bg-orange-200/30 blur-3xl" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight text-stone-900">
          {hero_tagline({}, { locale })}
        </h1>
        <p className="mt-6 text-lg md:text-xl leading-8 text-stone-600 max-w-5xl mx-auto">
          {hero_subtitle({}, { locale })}
        </p>

        <div className="mx-auto mt-8 flex max-w-2xl items-stretch rounded-box border border-base-300 bg-base-100 shadow-lg shadow-base-300/30 focus-within:border-primary">
          <CitySearchCombobox
            cities={cities}
            value={selectedCityCode}
            onSelect={setSelectedCityCode}
            placeholder={hero_search_placeholder({}, { locale })}
            noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
            locale={locale}
            className="flex-1"
          />
          <div className="aura aura-silver rounded-e-box">
            <Link
              {...(selectedCity
                ? isSelectedCityEmpty
                  ? { to: '/host/create', search: { city: selectedCity.code } }
                  : { to: '/$market/$city', params: { market: market.slug, city: selectedCity.slug } }
                : { to: '/login' })}
              className="btn btn-primary h-12 rounded-e-box border-0 bg-primary px-6 text-primary-content shadow-none"
            >
              {hero_search_cta({}, { locale })}
            </Link>
          </div>
        </div>

        {!selectedCity && cities.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-base-content/40">
              {hero_popular_cities({}, { locale })}
            </span>
            {[...cities]
              .sort(
                (a, b) =>
                  (cityEventCounts[b.code] ?? 0) - (cityEventCounts[a.code] ?? 0),
              )
              .slice(0, 6)
              .map((c) => {
                const count = cityEventCounts[c.code] ?? 0
                return (
                  <Link
                    key={c.code}
                    to="/$market/$city"
                    params={{ market: market.slug, city: c.slug }}
                    className={`btn btn-ghost btn-sm gap-2 border ${count > 0 ? 'border-primary' : 'border-base-300 hover:border-primary'}`}
                  >
                    {locale === 'ar' ? c.nameAr : c.name}
                    {count > 0 && (
                      <span className="badge badge-sm badge-primary">{count}</span>
                    )}
                  </Link>
                )
              })}
          </div>
        )}

        {selectedCity && !isSelectedCityEmpty && (
          <div className="mt-5 inline-flex items-center gap-2 text-sm text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {hero_social_proof(
              { count: selectedCityCount, city: cityDisplayName },
              { locale },
            )}
          </div>
        )}

        {selectedCity && isSelectedCityEmpty && (
          <div className="mx-auto mt-6 max-w-md rounded-box border border-base-300 bg-base-200/50 p-6 text-start">
            <h2 className="text-xl font-bold text-base-content">
              {hero_empty_city({ city: cityDisplayName }, { locale })}
            </h2>
            <p className="mt-2 text-sm text-base-content/60">
              {hero_empty_subtitle({ city: cityDisplayName }, { locale })}
            </p>
            <Link
              to="/host/create"
              search={{ city: selectedCity.code }}
              className="btn btn-primary btn-wide mt-4 gap-2"
            >
              ⚡ {hero_empty_cta({ city: cityDisplayName }, { locale })}
            </Link>
            {!showWaitlist ? (
              <button
                type="button"
                onClick={() => setShowWaitlist(true)}
                className="mt-3 block w-full text-center text-xs text-base-content/50 hover:text-base-content/80"
              >
                {hero_waitlist_prompt({ city: cityDisplayName }, { locale })}
              </button>
            ) : (
              <WaitlistForm
                locale={locale}
                marketCode={market.code}
                cityCode={selectedCity.code}
                cityName={cityDisplayName}
              />
            )}
            {[...cities]
              .filter((c) => c.code !== selectedCity.code && (cityEventCounts[c.code] ?? 0) > 0)
              .sort((a, b) => (cityEventCounts[b.code] ?? 0) - (cityEventCounts[a.code] ?? 0))
              .slice(0, 3)
              .length > 0 && (
              <div className="mt-4 border-t border-base-300 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">
                  {hero_adjacent_cities({}, { locale })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {[...cities]
                    .filter((c) => c.code !== selectedCity.code && (cityEventCounts[c.code] ?? 0) > 0)
                    .sort((a, b) => (cityEventCounts[b.code] ?? 0) - (cityEventCounts[a.code] ?? 0))
                    .slice(0, 3)
                    .map((c) => (
                      <Link
                        key={c.code}
                        to="/$market/$city"
                        params={{ market: market.slug, city: c.slug }}
                        className="btn btn-ghost btn-xs gap-1 border border-base-300 hover:border-primary"
                      >
                        {locale === 'ar' ? c.nameAr : c.name}
                        <span className="badge badge-xs badge-primary">
                          {cityEventCounts[c.code]}
                        </span>
                      </Link>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-base-content/40">
          {cities_in({ market: market.name }, { locale })}
        </h2>
        <div className="flex flex-wrap gap-3">
          {cities.map((c) => {
            const count = cityEventCounts[c.code] ?? 0;
            return (
              <Link
                key={c.code}
                to="/$market/$city"
                params={{ market: market.slug, city: c.slug }}
                className={`btn btn-ghost gap-2 border ${count > 0 ? 'border-primary' : 'border-base-300 hover:border-primary'}`}
              >
                {locale === 'ar' ? c.nameAr : c.name}
                <span
                  className={`badge badge-sm ${count > 0 ? 'badge-primary' : 'bg-base-300 text-base-content/40'}`}
                >
                  {count}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

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
    </>
  );
};
