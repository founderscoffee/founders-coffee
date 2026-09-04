import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  back_to_market,
  city_empty_cta,
  city_empty_title,
  feed_load_more,
  host_here,
  host_step1,
  host_step2,
  host_step3,
  no_filter_match,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { applyCityFilters, type CityFilterKey } from '../../lib/city-filters';
import { useUpcomingEvents } from '../../features/events/hooks';
import { EventCard } from '../events/EventCard';
import { CityFilters } from './CityFilters';
import { EmptyState } from './EmptyState';
import { Stepper } from '../host/Stepper';

type CityLandingProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  events: readonly EventFeedItem[];
};

const PAGE_SIZE = 20;

const marketDisplayName = (market: Market, locale: Locale) =>
  locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

export const CityLanding = ({
  locale,
  market,
  city,
  events,
}: CityLandingProps) => {
  const cityDisplayName = locale === 'ar' ? city.nameAr : city.name;
  const marketName = marketDisplayName(market, locale);
  const [filters, setFilters] = useState<readonly CityFilterKey[]>([]);

  const toggleFilter = (key: CityFilterKey) =>
    setFilters((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useUpcomingEvents({
      marketCode: market.code,
      cityCode: city.code,
      limit: PAGE_SIZE,
    });

  const items = data?.pages.flatMap((p) => p.items) ?? events;

  const loadMore = () => {
    void fetchNextPage();
  };

  if (items.length === 0) {
    const stepLabels = [
      host_step1({}, { locale }),
      host_step2({}, { locale }),
      host_step3({}, { locale }),
    ];

    return (
      <section className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          title={city_empty_title({ city: cityDisplayName }, { locale })}
          action={
            <Link
              to="/$market/host/create"
              params={{ market: market.slug }}
              search={{ city: city.code, state: city.stateCode }}
              className="btn btn-secondary h-12 px-5"
            >
              {city_empty_cta({}, { locale })}
            </Link>
          }
          secondary={
            <Link
              to="/$market"
              params={{ market: market.slug }}
              className="mt-2 text-label font-medium text-neutral underline decoration-secondary underline-offset-[3px] hover:text-base-content"
            >
              {back_to_market({ market: marketName }, { locale })}
            </Link>
          }
        />

        <div className="mx-auto mt-10 max-w-md">
          <Stepper current={1} total={3} labels={stepLabels} />
        </div>
      </section>
    );
  }

  const visible = applyCityFilters(items, filters, market.timezone, new Date());

  return (
    <section className="mx-auto flex max-w-content flex-col gap-5 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-1.5">
        <Link
          to="/$market"
          params={{ market: market.slug }}
          className="w-fit text-body-sm font-medium underline decoration-secondary underline-offset-[3px] hover:text-accent"
        >
          {back_to_market({ market: marketName }, { locale })}
        </Link>
        <span className="eyebrow">
          {marketName} · {cityDisplayName}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h2 font-semibold">
          {cityDisplayName}
        </h1>
        <Link
          to="/$market/host/create"
          params={{ market: market.slug }}
          search={{ city: city.code, state: city.stateCode }}
          className="btn btn-outline h-10 min-h-10 px-4"
        >
          {host_here({}, { locale })}
        </Link>
      </div>

      <CityFilters locale={locale} active={filters} onToggle={toggleFilter} />

      {visible.length === 0 ? (
        <EmptyState title={no_filter_match({}, { locale })} />
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3.5">
          {visible.map((e) => (
            <li key={e.id}>
              <EventCard
                event={e}
                locale={locale}
                timezone={market.timezone}
                marketSlug={market.slug}
                trailing="language"
              />
            </li>
          ))}
        </ul>
      )}

      {hasNextPage ? (
        <div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadMore}
            disabled={isFetchingNextPage}
          >
            {feed_load_more({}, { locale })}
          </button>
        </div>
      ) : null}
    </section>
  );
};
