import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  hero_search_no_match,
  hero_search_placeholder,
  host_city_sub,
  host_city_title,
  host_next,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import { HeroCitySearch } from '../landing/HeroCitySearch';
import { HostWizardHeader } from './HostWizardHeader';

type HostCityStepProps = {
  locale: Locale;
  market: Market;
};

export const HostCityStep = ({ locale, market }: HostCityStepProps) => {
  const navigate = useNavigate();
  const [city, setCity] = useState<geo.GeoCity | undefined>(undefined);

  const go = (selected: geo.GeoCity) =>
    void navigate({
      to: '/$market/host/create',
      params: { market: market.slug },
      search: { city: selected.code, state: selected.stateCode },
      replace: true,
    });

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 pb-16 md:pt-12">
      <HostWizardHeader locale={locale} />
      <section className="host-fade-up rounded-box border border-base-300 bg-base-100 p-6 md:p-7">
        <h2 className="font-display text-h3 font-semibold text-base-content">
          {host_city_title({}, { locale })}
        </h2>
        <p className="mt-1 text-body text-neutral">
          {host_city_sub({}, { locale })}
        </p>
        <div className="mt-5 flex h-12 w-full items-center rounded-full border border-base-300 bg-base-100 ps-2 pe-1.5 focus-within:border-secondary md:h-13">
          <HeroCitySearch
            marketCode={market.code}
            selected={city}
            onSelect={(selected) => {
              setCity(selected);
              go(selected);
            }}
            onClear={() => setCity(undefined)}
            placeholder={hero_search_placeholder({}, { locale })}
            noMatchText={hero_search_no_match({ query: '{query}' }, { locale })}
            locale={locale}
            className="flex-1"
          />
        </div>
        <Button
          variant="primary"
          disabled={!city}
          onClick={() => city && go(city)}
          className="mt-5 h-12 min-w-36 px-6 text-base font-semibold"
        >
          {host_next({}, { locale })}
        </Button>
      </section>
    </div>
  );
};
