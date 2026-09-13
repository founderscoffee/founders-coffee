import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
  back_to_market,
  city_empty_cta,
  city_empty_title,
  host_here,
  host_progress_label,
  host_step1_short,
  host_step2_short,
  host_step3_short,
  no_filter_match,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { EventFeedItem, EventFeedPage } from '@founders-coffee/server-fns';

import { applyCityFilters, type CityFilterKey } from '../../lib/city-filters';
import { useUpcomingEvents } from '../../features/events/hooks';
import { useEventPages } from '../../features/events/useEventPages';
import { LoadMoreEvents } from '../events/LoadMoreEvents';
import { EventCard } from '../events/EventCard';
import { CityFilters } from './CityFilters';
import { EmptyState } from './EmptyState';
import { WizardSteps } from '../host/WizardSteps';

type CityLandingProps = {
  locale: Locale;
  market: Market;
  city: geo.GeoCity;
  events: readonly EventFeedItem[];
  afterStartsAt?: number;
  afterId?: string;
  nextPageHref?: string;
  nextCursor?: EventFeedPage['nextCursor'];
};

const PAGE_SIZE = 20;

const marketDisplayName = (market: Market, locale: Locale) =>
  locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

export const CityLanding = ({
  locale,
  market,
  city,
  events,
  afterStartsAt,
  afterId,
  nextPageHref,
  nextCursor,
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

  if (items.length === 0) {
    const stepLabels = [
      host_step1_short({}, { locale }),
      host_step2_short({}, { locale }),
      host_step3_short({}, { locale }),
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
              className="mt-2 inline-flex min-h-6 items-center text-label font-medium text-neutral underline decoration-secondary underline-offset-[3px] hover:text-base-content"
            >
              {back_to_market({ market: marketName }, { locale })}
            </Link>
          }
        />

        <div className="mx-auto mt-10 max-w-md">
          <WizardSteps
            current={1}
            labels={stepLabels}
            ariaLabel={host_progress_label({}, { locale })}
          />
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
          className="inline-flex min-h-6 w-fit items-center text-body-sm font-medium underline decoration-secondary underline-offset-[3px] hover:text-accent"
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

      <LoadMoreEvents
        locale={locale}
        pagination={pagination}
        nextPageHref={nextPageHref}
      />
    </section>
  );
};
