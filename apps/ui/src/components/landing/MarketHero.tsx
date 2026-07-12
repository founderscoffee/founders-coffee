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

export const MarketHero = ({ locale, market, cityEventCounts }: MarketHeroProps) => {
  const [selectedCity, setSelectedCity] = useState<geo.GeoCity | undefined>(undefined);

  const selectedCityCount = selectedCity ? (cityEventCounts[selectedCity.code] ?? 0) : 0;
  const isSelectedCityEmpty = selectedCity !== undefined && selectedCityCount === 0;
  const cityDisplayName = selectedCity
    ? locale === 'ar'
      ? selectedCity.nameAr
      : selectedCity.name
    : '';

  return (
    <section className="relative pb-12 pt-8 md:pt-12 mx-auto text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[600px] max-w-5xl overflow-hidden"
      >
        <div className="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-12 h-[400px] w-[550px] -translate-x-1/2 rounded-full bg-orange-200/30 blur-3xl" />
      </div>
      <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight text-stone-900">
        {hero_tagline({}, { locale })}
      </h1>
      <p className="mt-6 text-lg md:text-xl leading-8 text-stone-600 max-w-5xl mx-auto">
        {hero_subtitle({}, { locale })}
      </p>

      <div className="mx-auto mt-8 flex max-w-2xl items-stretch rounded-box border border-base-300 bg-base-100 shadow-lg shadow-base-300/30 focus-within:border-primary">
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
        <div className="aura aura-silver rounded-e-box">
          <Link
            {...(selectedCity
              ? isSelectedCityEmpty
                ? { to: '/$market/host/create', params: { market: market.slug }, search: { city: selectedCity.code, state: selectedCity.stateCode } }
                : {
                    to: '/$market/$city',
                    params: { market: market.slug, city: selectedCity.slug },
                  }
              : { to: '/login' })}
            className="btn btn-primary h-12 rounded-e-box border-0 bg-primary px-6 text-primary-content shadow-none"
          >
            {hero_search_cta({}, { locale })}
          </Link>
        </div>
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
