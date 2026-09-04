import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import {
  hero_active_cities,
  hero_major_cities,
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
  if (trending.groups.length === 0) return null;

  const title =
    trending.variant === 'active'
      ? hero_active_cities({}, { locale })
      : hero_major_cities({}, { locale });

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <h2 className="eyebrow mb-4">{title}</h2>
      <div className="space-y-6">
        {trending.groups.map(({ state, cities }) => (
          <div key={state?.code ?? 'major'}>
            {state ? (
              <h3 className="mb-2 text-body-sm font-semibold text-base-content">
                {locale === 'ar' ? state.nameAr : state.name}
              </h3>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {cities.map(({ city, count }) => (
                <Link
                  key={city.code}
                  to="/$market/$city"
                  params={{ market: market.slug, city: city.slug }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-base-200 px-3 text-label font-medium text-base-content transition-colors hover:bg-base-300"
                >
                  {locale === 'ar' ? city.nameAr : city.name}
                  {count > 0 ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="font-semibold text-accent"
                      >
                        {count > 99 ? '+99' : count}
                      </span>
                      <span className="sr-only">
                        {this_week_n({ n: count }, { locale })}
                      </span>
                    </>
                  ) : null}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
