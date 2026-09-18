import { Link } from '@tanstack/react-router';
import { Plus, UsersRound } from 'lucide-react';

import type { Market } from '@founders-coffee/db';
import {
  city_empty_cta,
  host_in_your_city,
  this_week_n,
  type Locale,
} from '@founders-coffee/i18n';
import type { TrendingSection } from '@founders-coffee/server-fns';
import { localizedHostCreate } from '../../lib/locale-routing';

const CITY_CARD_COUNT = 11;

type TrendingStatesProps = {
  locale: Locale;
  market: Market;
  trending: TrendingSection;
};

export const TrendingStates = ({
  locale,
  market,
  trending,
}: TrendingStatesProps) => {
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;
  const cities = trending.groups
    .flatMap((group) => group.cities)
    .slice(0, CITY_CARD_COUNT);

  return (
    <section className="mx-auto max-w-content px-4 pt-10 pb-2 md:px-8 md:pt-14">
      <ul
        aria-label={marketName}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cities.map(({ city, count }) => {
          const headingId = `market-city-${market.slug}-${city.slug}`;
          return (
            <li key={city.code} className="h-full">
              <Link
                to="/$market/$city/$subcity"
                params={{
                  market: locale,
                  city: market.slug,
                  subcity: city.slug,
                }}
                aria-labelledby={headingId}
                className={`inline-block h-full min-h-24 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${count > 0 ? 'aura aura-dual text-accent' : ''}`}
              >
                <article
                  className={`card flex h-full min-h-24 flex-col gap-2 rounded-box px-4 py-3 text-base-content transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none ${
                    count > 0
                      ? 'bg-base-100'
                      : 'border border-base-300 bg-base-200'
                  }`}
                >
                  <header className="flex items-start justify-between gap-2">
                    <h3
                      id={headingId}
                      className="font-display text-body-lg font-semibold leading-tight tracking-tight"
                    >
                      {locale === 'ar' ? city.nameAr : city.name}
                    </h3>
                    <span className="flex shrink-0 items-center gap-1 text-accent">
                      <UsersRound className="size-4" aria-hidden="true" />
                      <data
                        value={count}
                        className="font-display text-body-lg font-semibold leading-none"
                      >
                        {count > 99 ? '+99' : count}
                      </data>
                    </span>
                  </header>
                  <p
                    className={`mt-auto text-body-sm font-medium ${count > 0 ? 'text-neutral' : 'text-accent'}`}
                  >
                    {count > 0
                      ? this_week_n({ n: count }, { locale })
                      : city_empty_cta({}, { locale })}
                  </p>
                </article>
              </Link>
            </li>
          );
        })}
        <li className="h-full">
          <Link
            {...localizedHostCreate(locale, market.slug)}
            aria-labelledby="market-create-card"
            className="inline-block h-full min-h-24 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <article className="card flex h-full min-h-24 items-center justify-center gap-2 rounded-box border border-primary bg-primary px-4 py-3 text-center text-primary-content transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none">
              <Plus
                className="size-5 text-primary-content"
                aria-hidden="true"
              />
              <h3
                id="market-create-card"
                className="font-display text-body-lg font-semibold leading-tight tracking-tight"
              >
                {host_in_your_city({}, { locale })}
              </h3>
            </article>
          </Link>
        </li>
      </ul>
    </section>
  );
};
