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

import heroAlgeria from '../../assets/hero-algeria.webp';
import heroEgypt from '../../assets/hero-egypt.webp';
import heroSaudi from '../../assets/hero-saudi.webp';

const HERO_ART: Record<string, string> = {
  DZ: heroAlgeria,
  EG: heroEgypt,
  SA: heroSaudi,
};

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
  const heroArt = HERO_ART[market.code];
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;
  const cityDisplayName = selectedCity
    ? locale === 'ar'
      ? selectedCity.nameAr
      : selectedCity.name
    : '';

  return (
    <section className="relative isolate flex min-h-[calc(min(100vw,2172px)/2.99)] items-center bg-base-200">
      {heroArt && (
        <img
          src={heroArt}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 mx-auto h-auto w-full max-w-[2172px] select-none"
        />
      )}
      <div className="mx-auto flex w-full max-w-content flex-col items-center px-4 pt-10 pb-[calc(33.4vw+1rem)] text-center md:px-8 md:pt-14 md:pb-14">
        <span className="inline-flex h-[26px] items-center rounded-full bg-base-100 px-2.5 text-caption font-medium">
          {marketName}
        </span>
        <h1 className="mt-4 font-display text-h2 font-semibold tracking-tight text-balance text-base-content md:text-h1">
          {hero_tagline({}, { locale })}
        </h1>
        <p className="mx-auto mt-3 max-w-prose text-body text-neutral md:text-body-lg">
          {hero_subtitle({}, { locale })}
        </p>

        <div className="mt-6 flex h-12 w-full max-w-lg items-center rounded-full border border-base-300 bg-base-100 ps-2 pe-1.5 focus-within:border-secondary md:h-13">
          <HeroCitySearch
            marketCode={market.code}
            selected={selectedCity}
            onSelect={setSelectedCity}
            onClear={() => setSelectedCity(undefined)}
            placeholder={hero_search_placeholder({}, { locale })}
            noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
            locale={locale}
            className="min-w-0 flex-1"
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
            className="btn btn-primary hidden h-9 min-h-9 shrink-0 rounded-full border-0 px-4 text-body shadow-none sm:inline-flex"
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
      </div>
    </section>
  );
};
