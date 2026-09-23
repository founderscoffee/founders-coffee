import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  back_to_market,
  city_events_description,
  city_empty_cta,
  city_empty_title,
  city_loaded_count,
  city_upcoming_title,
  cityInputs,
  host_meetup_here,
  localizedName,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { EventFeedItem, EventFeedPage } from '@founders-coffee/server-fns';

import { applyCityFilters, type CityFilterKey } from '../../lib/city-filters';
import {
  localizedHostCreate,
  localizedLanding,
} from '../../lib/locale-routing';
import { useUpcomingEvents } from '../../features/events/hooks';
import { useEventPages } from '../../features/events/useEventPages';
import { useLoadUntilMatch } from '../../features/events/useLoadUntilMatch';
import { LoadMoreEvents } from '../events/LoadMoreEvents';
import { EventCard } from '../events/EventCard';
import { CityFilters } from './CityFilters';
import { EmptyState } from './EmptyState';
import { NoMatchingMeetups } from './NoMatchingMeetups';

type CityLandingProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  events: readonly EventFeedItem[];
  afterStartsAt?: number;
  afterId?: string;
  nextCursor?: EventFeedPage['nextCursor'];
};

const PAGE_SIZE = 20;

export const CityLanding = ({
  locale,
  market,
  city,
  events,
  afterStartsAt,
  afterId,
  nextCursor,
}: CityLandingProps) => {
  const cityDisplayName = localizedName(city, locale);
  const cityNameInputs = cityInputs(cityDisplayName);
  const marketName = localizedName(market, locale);
  const [filters, setFilters] = useState<readonly CityFilterKey[]>([]);

  const toggleFilter = (key: CityFilterKey) =>
    setFilters((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );

  const pagination = useEventPages(
    useUpcomingEvents(
      {
        marketCode: market.code,
        cityCode: city.code,
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
  const hasEvents = items.length > 0;
  const visible = applyCityFilters(items, filters, market.timezone, new Date());
  const search = useLoadUntilMatch(pagination, visible.length);
  const pageHeader = (
    <header className="flex flex-col gap-4">
      <nav aria-label={back_to_market({ market: marketName }, { locale })}>
        <Link
          {...localizedLanding(locale, market.slug)}
          className="inline-flex min-h-6 w-fit items-center text-body-sm font-medium underline decoration-secondary underline-offset-[3px] hover:text-accent"
        >
          {back_to_market({ market: marketName }, { locale })}
        </Link>
      </nav>
      <span className="eyebrow">
        {marketName} · {cityDisplayName}
      </span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1
            id="city-page-title"
            className="font-display text-h2 font-semibold"
          >
            {cityDisplayName}
          </h1>
          {hasEvents && (
            <p className="mt-2 max-w-prose text-body text-neutral">
              {city_events_description(cityNameInputs, { locale })}
            </p>
          )}
        </div>
        {hasEvents && (
          <Link
            {...localizedHostCreate(locale, market.slug)}
            search={{ city: city.code, state: city.stateCode }}
            className="btn btn-outline h-10 min-h-10 px-4"
          >
            {host_meetup_here({}, { locale })}
          </Link>
        )}
      </div>
    </header>
  );

  if (!hasEvents) {
    return (
      <section
        aria-labelledby="city-page-title"
        className="mx-auto flex max-w-content flex-col gap-8 px-4 py-8 md:px-8"
      >
        {pageHeader}
        <EmptyState
          title={city_empty_title(cityNameInputs, { locale })}
          action={
            <Link
              {...localizedHostCreate(locale, market.slug)}
              search={{ city: city.code, state: city.stateCode }}
              className="btn btn-secondary h-12 px-5"
            >
              {city_empty_cta({}, { locale })}
            </Link>
          }
        />
      </section>
    );
  }

  return (
    <section
      aria-labelledby="city-page-title"
      className="mx-auto flex max-w-content flex-col gap-8 px-4 py-8 md:px-8"
    >
      {pageHeader}
      <section
        aria-labelledby="city-events-title"
        className="flex flex-col gap-5"
      >
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="city-events-title"
              className="font-display text-h4 font-semibold"
            >
              {city_upcoming_title(cityNameInputs, { locale })}
            </h2>
            <p aria-live="polite" className="mt-1 text-body-sm text-neutral">
              {city_loaded_count({ count: visible.length }, { locale })}
            </p>
          </div>
          <CityFilters
            locale={locale}
            active={filters}
            onToggle={toggleFilter}
          />
        </header>

        {search === 'matched' ? (
          <ul
            aria-labelledby="city-events-title"
            className="grid grid-cols-1 gap-3.5"
          >
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
        ) : (
          <NoMatchingMeetups
            locale={locale}
            search={search}
            onClear={() => setFilters([])}
            onRetry={pagination.loadMore}
          />
        )}
      </section>

      {search === 'matched' && (
        <LoadMoreEvents locale={locale} pagination={pagination} />
      )}
    </section>
  );
};
