import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';

import type { Market } from '@founders-coffee/db';
import {
  city_empty_cta,
  city_hosts_count,
  city_upcoming_count,
  host_in_your_city,
  localizedName,
  market_cities,
  type Locale,
} from '@founders-coffee/i18n';
import type { TrendingSection } from '@founders-coffee/server-fns';
import { localizedCity, localizedHostCreate } from '../../lib/locale-routing';
import { HostFace } from '../events/HostFace';

const CITY_CARD_COUNT = 11;
const HOST_BUBBLE_CAP = 99;

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
  const marketName = localizedName(market, locale);
  const cities = trending.groups
    .flatMap((group) => group.cities)
    .slice(0, CITY_CARD_COUNT);

  return (
    <section
      aria-labelledby="market-cities-title"
      className="mx-auto max-w-content px-4 pt-10 pb-2 md:px-8 md:pt-14"
    >
      <h2 id="market-cities-title" className="sr-only">
        {market_cities({}, { locale })}
      </h2>
      <ul
        aria-label={marketName}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cities.map(({ city, count, hosts, hostCount }) => {
          const headingId = `market-city-${market.slug}-${city.slug}`;
          const unseenHosts = Math.min(
            hostCount - hosts.length,
            HOST_BUBBLE_CAP,
          );
          return (
            <li key={city.code} className="h-full">
              <Link
                {...localizedCity(locale, market.slug, city.slug)}
                aria-labelledby={headingId}
                className={`inline-block h-full min-h-20 sm:min-h-24 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary ${count > 0 ? 'aura aura-glow text-accent' : ''}`}
              >
                <article
                  className={`card flex h-full min-h-20 sm:min-h-24 flex-col gap-2 rounded-box px-4 py-3 text-base-content transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none ${
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
                      {localizedName(city, locale)}
                    </h3>
                    {hosts.length > 0 ? (
                      <span
                        role="img"
                        aria-label={city_hosts_count(
                          { count: hostCount },
                          { locale },
                        )}
                        className="avatar-group -space-x-3 shrink-0 overflow-visible"
                      >
                        {hosts.map((host, index) => (
                          <HostFace
                            key={`host-${index}`}
                            name={host.name}
                            photoAssetId={host.photoAssetId}
                            className="size-8 border-2 border-base-100"
                          />
                        ))}
                        {unseenHosts > 0 ? (
                          <span className="avatar avatar-placeholder size-8 shrink-0 border-2 border-base-100">
                            <span
                              dir="ltr"
                              className="flex size-full items-center justify-center rounded-full bg-base-200 text-caption font-semibold text-base-content"
                            >
                              +{unseenHosts}
                            </span>
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </header>
                  <p
                    className={`mt-auto text-body-sm font-medium ${count > 0 ? 'text-neutral' : 'text-accent'}`}
                  >
                    {count > 0
                      ? city_upcoming_count({ count }, { locale })
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
            className="inline-block h-full min-h-20 sm:min-h-24 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
          >
            <article className="card flex h-full min-h-20 sm:min-h-24 items-center justify-center gap-2 rounded-box border border-primary bg-primary px-4 py-3 text-center text-primary-content transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none">
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
