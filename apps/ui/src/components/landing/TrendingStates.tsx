import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import { hero_popular_cities, type Locale } from '@founders-coffee/i18n';
import type { TrendingState } from '@founders-coffee/server-fns';

type TrendingStatesProps = {
  locale: Locale;
  market: Market;
  trendingStates: readonly TrendingState[];
};

export const TrendingStates = ({ locale, market, trendingStates }: TrendingStatesProps) => {
  if (trendingStates.length === 0) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-base-content/40">
        {hero_popular_cities({}, { locale })}
      </h2>
      <div className="space-y-6">
        {trendingStates.map(({ state, cities }) => (
          <div key={state.code}>
            <h3 className="mb-2 text-sm font-bold text-base-content/70">
              {locale === 'ar' ? state.nameAr : state.name}
            </h3>
            <div className="flex flex-wrap gap-3">
              {cities.map(({ city, count }) => (
                <div key={city.code} className="aura aura-glow rounded-full">
                  <Link
                    to="/$market/$city"
                    params={{ market: market.slug, city: city.slug }}
                    className={`btn gap-2 rounded-full border bg-base-200 hover:bg-base-300 ${count > 0 ? 'border-primary' : 'border-base-300 hover:border-primary'}`}
                  >
                    {locale === 'ar' ? city.nameAr : city.name}
                    <span
                      className={`badge badge-sm ${count > 0 ? 'badge-primary' : 'bg-base-300 text-base-content/40'}`}
                    >
                      {count > 99 ? '+99' : count}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
