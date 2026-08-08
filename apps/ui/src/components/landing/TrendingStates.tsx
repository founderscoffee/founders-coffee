import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import { hero_active_cities, hero_major_cities, type Locale } from '@founders-coffee/i18n';
import type { TrendingSection } from '@founders-coffee/server-fns';

type TrendingStatesProps = {
  locale: Locale;
  market: Market;
  trending: TrendingSection;
};

export const TrendingStates = ({ locale, market, trending }: TrendingStatesProps) => {
  if (trending.groups.length === 0) return null;

  const title =
    trending.variant === 'active'
      ? hero_active_cities({}, { locale })
      : hero_major_cities({}, { locale });

  return (
    <section className="mx-auto max-w-5xl px-4 pb-12">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-base-content/40">
        {title}
      </h2>
      <div className="space-y-6">
        {trending.groups.map(({ state, cities }) => (
          <div key={state?.code ?? 'major'}>
            {state ? (
              <h3 className="mb-2 text-sm font-bold text-base-content/70">
                {locale === 'ar' ? state.nameAr : state.name}
              </h3>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {cities.map(({ city, count }) => (
                <div
                  key={city.code}
                  className={count > 0 ? 'aura aura-glow rounded-full' : 'rounded-full'}
                >
                  <Link
                    to="/$market/$city"
                    params={{ market: market.slug, city: city.slug }}
                    className={`btn btn-sm gap-1.5 rounded-full border bg-base-200 text-sm hover:bg-base-300 ${
                      count > 0
                        ? 'border-primary'
                        : 'border-base-300 hover:border-primary'
                    }`}
                  >
                    {locale === 'ar' ? city.nameAr : city.name}
                    {count > 0 ? (
                      <span className="badge badge-xs badge-primary">
                        {count > 99 ? '+99' : count}
                      </span>
                    ) : null}
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
