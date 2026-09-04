import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import {
  cities_in,
  city_empty_cta,
  this_week_n,
  type Locale,
} from '@founders-coffee/i18n';
import type { TrendingSection } from '@founders-coffee/server-fns';

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
  const cities = trending.groups.flatMap((group) => group.cities);

  return (
    <section className="mx-auto max-w-content px-4 pt-8 md:px-8">
      <h2 className="mb-4 font-display text-h4 font-semibold">
        {cities_in({ market: marketName }, { locale })}
      </h2>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
        {cities.map(({ city, count }) => (
          <li key={city.code}>
            <Link
              to="/$market/$city"
              params={{ market: market.slug, city: city.slug }}
              className={`flex h-full min-h-[5.25rem] flex-col gap-3 rounded-box px-4 py-3.5 transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none ${
                count > 0 ? 'bg-base-100' : 'bg-base-200'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-body-lg font-semibold leading-none">
                  {locale === 'ar' ? city.nameAr : city.name}
                </span>
                {count > 0 ? (
                  <span className="font-display text-body-lg font-semibold leading-none text-accent">
                    {count > 99 ? '+99' : count}
                  </span>
                ) : null}
              </span>
              <span
                className={`mt-auto text-caption font-medium ${count > 0 ? 'text-neutral' : 'text-accent'}`}
              >
                {count > 0
                  ? this_week_n({ n: count }, { locale })
                  : city_empty_cta({}, { locale })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
