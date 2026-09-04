import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  hero_search_cta,
  hero_search_no_match,
  hero_search_placeholder,
  hero_subtitle,
  hero_tagline,
  type Locale,
} from '@founders-coffee/i18n';

import { CitySelectionFeedback } from './CitySelectionFeedback';
import { EmptyCityCard } from './EmptyCityCard';
import { HeroCitySearch } from './HeroCitySearch';

type MarketHeroProps = {
  locale: Locale;
  market: Market;
  cityEventCounts: Record<string, number>;
};

export const MarketHero = ({
  locale,
  market,
  cityEventCounts,
}: MarketHeroProps) => {
  const [selectedCity, setSelectedCity] = useState<geo.GeoCity | undefined>(
    undefined,
  );

  const selectedCityCount = selectedCity
    ? (cityEventCounts[selectedCity.code] ?? 0)
    : 0;
  const isSelectedCityEmpty =
    selectedCity !== undefined && selectedCityCount === 0;
  const cityDisplayName = selectedCity
    ? locale === 'ar'
      ? selectedCity.nameAr
      : selectedCity.name
    : '';

  return (
    <section className="mx-auto pb-12 pt-8 text-center md:pt-12">
      <h1 className="font-display text-h1 font-semibold tracking-tight text-balance text-base-content md:text-display">
        {hero_tagline({}, { locale })}
      </h1>
      <p className="mx-auto mt-6 max-w-prose text-body-lg text-neutral">
        {hero_subtitle({}, { locale })}
      </p>

      <div className="mx-auto mt-8 flex h-12 max-w-2xl items-center rounded-full border border-base-300 bg-base-100 ps-2 pe-1.5 focus-within:border-secondary md:h-14">
        <HeroCitySearch
          marketCode={market.code}
          selected={selectedCity}
          onSelect={setSelectedCity}
          onClear={() => setSelectedCity(undefined)}
          placeholder={hero_search_placeholder({}, { locale })}
          noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
          locale={locale}
          className="flex-1"
        />
        <Link
          {...(selectedCity
            ? isSelectedCityEmpty
              ? {
                  to: '/$market/host/create',
                  params: { market: market.slug },
                  search: {
                    city: selectedCity.code,
                    state: selectedCity.stateCode,
                  },
                }
              : {
                  to: '/$market/$city',
                  params: { market: market.slug, city: selectedCity.slug },
                }
            : { to: '/login' })}
          className="btn btn-primary h-9 min-h-9 shrink-0 rounded-full border-0 px-4 shadow-none"
        >
          {hero_search_cta({}, { locale })}
        </Link>
      </div>

      {selectedCity && !isSelectedCityEmpty && (
        <CitySelectionFeedback
          locale={locale}
          selectedCityCount={selectedCityCount}
          cityDisplayName={cityDisplayName}
        />
      )}

      {selectedCity && isSelectedCityEmpty && (
        <EmptyCityCard
          locale={locale}
          market={market}
          selectedCity={selectedCity}
          cityDisplayName={cityDisplayName}
        />
      )}
    </section>
  );
};
