import { MapPin } from 'lucide-react';
import { useId } from 'react';

import type { geo } from '@founders-coffee/domain';
import {
  host_city_suggestions,
  localizedName,
  type Locale,
} from '@founders-coffee/i18n';

import { useCitySuggestions } from '../../features/geo/hooks';

const SHOWN = 3;

type CitySuggestionsProps = {
  locale: Locale;
  marketCode: string;
  query: string;
  currentCityCode?: string;
  onSelect: (city: geo.GeoCity) => void;
};

export const CitySuggestions = ({
  locale,
  marketCode,
  query,
  currentCityCode,
  onSelect,
}: CitySuggestionsProps) => {
  const labelId = useId();
  const { data } = useCitySuggestions(marketCode, query, SHOWN + 1);
  const cities = (data ?? [])
    .filter(({ city }) => city.code !== currentCityCode)
    .slice(0, SHOWN);

  if (cities.length === 0) return null;

  return (
    <div>
      <p id={labelId} className="mb-1.5 text-caption text-neutral">
        {host_city_suggestions({}, { locale })}
      </p>
      <ul aria-labelledby={labelId} className="flex flex-col gap-1">
        {cities.map(({ city, state }) => (
          <li key={city.code}>
            <button
              type="button"
              onClick={() => onSelect(city)}
              className="flex w-full items-center gap-3 rounded-box px-3 py-2.5 text-start transition-colors duration-[var(--duration-fast)] hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary motion-reduce:transition-none"
            >
              <MapPin
                className="size-4 shrink-0 text-neutral"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold text-base-content">
                  <bdi>{localizedName(city, locale)}</bdi>
                </span>
                <span className="block truncate text-caption text-neutral">
                  <bdi>{localizedName(state, locale)}</bdi>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
