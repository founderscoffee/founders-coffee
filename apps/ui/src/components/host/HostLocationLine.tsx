import { MapPin } from 'lucide-react';

import type { geo } from '@founders-coffee/domain';
import {
  host_location_change,
  host_location_derived,
  host_location_label,
  host_location_unknown,
  type Locale,
} from '@founders-coffee/i18n';

type HostLocationLineProps = {
  locale: Locale;
  city: geo.GeoCity | null;
  state: geo.GeoState | null;
  onChange: () => void;
};

export const HostLocationLine = ({
  locale,
  city,
  state,
  onChange,
}: HostLocationLineProps) => {
  const parts = [
    city ? (locale === 'ar' ? city.nameAr : city.name) : null,
    state ? (locale === 'ar' ? state.nameAr : state.name) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-base-300 p-4">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-caption font-semibold text-neutral">
          <MapPin className="size-4 text-primary" aria-hidden="true" />
          {host_location_label({}, { locale })}
        </p>
        <p className="mt-1 truncate font-semibold" dir="auto">
          {parts.length > 0
            ? parts.join(' · ')
            : host_location_unknown({}, { locale })}
        </p>
        <p className="text-caption text-taupe">
          {host_location_derived({}, { locale })}
        </p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className="btn btn-outline btn-sm rounded-full"
      >
        {host_location_change({}, { locale })}
      </button>
    </div>
  );
};
