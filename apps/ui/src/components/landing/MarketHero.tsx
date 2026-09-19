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
  localizedName,
  type Locale,
} from '@founders-coffee/i18n';

import { CitySelectionFeedback } from './CitySelectionFeedback';
import { EmptyCityCard } from './EmptyCityCard';
import { HeroCitySearch } from './HeroCitySearch';

import heroAlgeria from '../../assets/hero-algeria.webp';
import heroAlgeriaDesktop from '../../assets/hero-algeria-desktop.webp';
import heroAlgeriaMobile from '../../assets/hero-algeria-mobile.webp';
import heroEgypt from '../../assets/hero-egypt.webp';
import heroEgyptDesktop from '../../assets/hero-egypt-desktop.webp';
import heroEgyptMobile from '../../assets/hero-egypt-mobile.webp';
import heroSaudi from '../../assets/hero-saudi.webp';
import heroSaudiDesktop from '../../assets/hero-saudi-desktop.webp';
import heroSaudiMobile from '../../assets/hero-saudi-mobile.webp';
import { localizedHostCreate } from '../../lib/locale-routing';

const EVENTS_ANCHOR = 'market-events';

const CTA_CLASS =
  'btn btn-primary hidden h-9 min-h-9 shrink-0 rounded-full border-0 px-4 text-body shadow-none sm:inline-flex';

const HERO_ART: Record<string, string> = {
  DZ: heroAlgeria,
  EG: heroEgypt,
  SA: heroSaudi,
};

const HERO_ART_MOBILE: Record<string, string> = {
  DZ: heroAlgeriaMobile,
  EG: heroEgyptMobile,
  SA: heroSaudiMobile,
};

const HERO_ART_DESKTOP: Record<string, string> = {
  DZ: heroAlgeriaDesktop,
  EG: heroEgyptDesktop,
  SA: heroSaudiDesktop,
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
  const heroArtDesktop = HERO_ART_DESKTOP[market.code];
  const heroArtMobile = HERO_ART_MOBILE[market.code];
  const cityDisplayName = selectedCity
    ? localizedName(selectedCity, locale)
    : '';

  return (
    <section
      aria-labelledby="market-hero-title"
      className="relative isolate flex min-h-[calc(min(100vw,2172px)/2.99)] items-center bg-base-200"
    >
      <div className="hero-stack @container mx-auto flex w-full max-w-content flex-col items-center px-4 pt-10 pb-9 text-center md:px-8 md:pt-14 md:pb-14">
        <h1
          id="market-hero-title"
          className="font-display text-display-fit font-semibold text-base-content"
        >
          {hero_tagline({}, { locale })}
        </h1>
        <p className="hero-subtitle mx-auto mt-4 max-w-prose text-body-lg text-balance text-neutral">
          {hero_subtitle({}, { locale })}
        </p>

        {heroArt && (
          <picture className="hero-art pointer-events-none -mx-4 mt-2 block w-[calc(100%+2rem)] select-none md:absolute md:inset-x-0 md:bottom-0 md:-z-10 md:mx-auto md:mt-0 md:w-full md:max-w-[2172px]">
            <source
              media="(max-width: 767px)"
              srcSet={heroArtMobile ?? heroArt}
              sizes="100vw"
            />
            <source
              media="(min-width: 768px)"
              srcSet={`${heroArtDesktop ?? heroArt} 1440w, ${heroArt} 2172w`}
              sizes="(max-width: 2172px) 100vw, 2172px"
            />
            <img
              src={heroArt}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="block h-auto w-full"
            />
          </picture>
        )}

        <div
          role="search"
          className="hero-search mt-1 flex h-12 w-full max-w-lg items-center rounded-full border border-base-300 bg-base-100 ps-2 pe-1.5 focus-within:border-secondary md:mt-6 md:h-13"
        >
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
          {selectedCity ? (
            <Link
              {...(isSelectedCityEmpty
                ? {
                    ...localizedHostCreate(locale, market.slug),
                    search: {
                      city: selectedCity.code,
                      state: selectedCity.stateCode,
                    },
                  }
                : {
                    to: '/$market/$city/$subcity',
                    params: {
                      market: locale,
                      city: market.slug,
                      subcity: selectedCity.slug,
                    },
                  })}
              className={CTA_CLASS}
            >
              {hero_search_cta({}, { locale })}
            </Link>
          ) : (
            <a href={`#${EVENTS_ANCHOR}`} className={CTA_CLASS}>
              {hero_search_cta({}, { locale })}
            </a>
          )}
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
