import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import {
  cities_in,
  city_empty_cta,
  this_week_n,
  type Locale,
} from '@founders-coffee/i18n';
import type { TrendingSection } from '@founders-coffee/server-fns';
import { LogoSymbol } from '@founders-coffee/ui';

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

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cities.map(({ city, count }) => (
          <li key={city.code}>
            <Link
              to="/$market/$city"
              params={{ market: market.slug, city: city.slug }}
              className={`flex h-full flex-col justify-between rounded-box p-4 transition-colors ${
                count > 0
                  ? 'border border-base-300 bg-base-100 hover:bg-base-200'
                  : 'bg-base-200 hover:bg-base-300'
              }`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-display text-body font-semibold">
                  {locale === 'ar' ? city.nameAr : city.name}
                </span>
                {count > 0 ? (
                  <span className="font-display text-body font-semibold text-accent">
                    {count > 99 ? '+99' : count}
                  </span>
                ) : (
                  <LogoSymbol size={18} tone="sand" />
                )}
              </span>
              <span
                className={`mt-3 text-caption ${count > 0 ? 'text-neutral' : 'font-medium text-accent'}`}
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
