import {
  city_filters_label,
  filter_ar,
  filter_en,
  filter_fr,
  filter_today,
  filter_weekend,
  type Locale,
} from '@founders-coffee/i18n';

import { CITY_FILTER_KEYS, type CityFilterKey } from '../../lib/city-filters';

const LABELS = {
  today: filter_today,
  weekend: filter_weekend,
  ar: filter_ar,
  en: filter_en,
  fr: filter_fr,
} satisfies Record<CityFilterKey, typeof filter_today>;

type CityFiltersProps = {
  locale: Locale;
  active: readonly CityFilterKey[];
  onToggle: (key: CityFilterKey) => void;
};

export const CityFilters = ({ locale, active, onToggle }: CityFiltersProps) => (
  <fieldset className="flex flex-wrap gap-2">
    <legend className="sr-only">{city_filters_label({}, { locale })}</legend>
    {CITY_FILTER_KEYS.map((key) => {
      const on = active.includes(key);
      return (
        <button
          key={key}
          type="button"
          aria-pressed={on}
          onClick={() => onToggle(key)}
          className={`inline-flex h-10 items-center rounded-full px-3.5 text-body-sm font-medium transition-colors duration-[var(--duration-fast)] motion-reduce:transition-none ${
            on
              ? 'bg-primary text-primary-content shadow-[var(--shadow-1)]'
              : 'bg-base-200 text-base-content hover:bg-base-300'
          }`}
        >
          {LABELS[key]({}, { locale })}
        </button>
      );
    })}
  </fieldset>
);
