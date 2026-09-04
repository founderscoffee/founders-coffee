import { Link } from '@tanstack/react-router';

import {
  back_to_market,
  city_empty_cta,
  city_empty_title,
  feed_load_more,
  host_step1,
  host_step2,
  host_step3,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { useUpcomingEvents } from '../../features/events/hooks';
import { EventCard } from '../events/EventCard';
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

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="mb-6 text-3xl font-extrabold">{cityDisplayName}</h1>
      <div className="space-y-4">
        {items.map((e) => (
          <EventCard
            key={e.id}
            event={e}
            locale={locale}
            timezone={market.timezone}
            marketSlug={market.slug}
          />
        ))}
        {hasNextPage ? (
          <div className="pt-2">
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
      </div>
      <div className="mt-10">
        <Link
          to="/$market"
          params={{ market: market.slug }}
          className="text-sm text-base-content/40 hover:text-primary"
        >
          {back_to_market({ market: marketName }, { locale })}
        </Link>
      </div>
    </section>
  );
};
