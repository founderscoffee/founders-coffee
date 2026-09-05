import { Link } from '@tanstack/react-router';

import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';
import {
  host_outside_city,
  host_outside_market,
  host_pick_city,
  host_switch_city,
  type Locale,
} from '@founders-coffee/i18n';

type HostCityMismatchProps = {
  locale: Locale;
  market: Market;
  cityName: string;
  suggested: geo.GeoCity | null;
  onDismiss: () => void;
};

export const HostCityMismatch = ({
  locale,
  market,
  cityName,
  suggested,
  onDismiss,
}: HostCityMismatchProps) => {
  const suggestedName = suggested
    ? locale === 'ar'
      ? suggested.nameAr
      : suggested.name
    : '';
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;

  return (
    <div
      className="rounded-box border border-base-300 bg-secondary-tint p-3.5"
      role="status"
    >
      <p className="text-body-sm text-base-content">
        {suggested
          ? host_outside_city({ city: cityName }, { locale })
          : host_outside_market({ market: marketName }, { locale })}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {suggested ? (
          <Link
            to="/$market/host/create"
            params={{ market: market.slug }}
            search={{ city: suggested.code, state: suggested.stateCode }}
            className="btn btn-secondary btn-sm rounded-full border-0"
            onClick={onDismiss}
          >
            {host_switch_city({ city: suggestedName }, { locale })}
          </Link>
        ) : (
          <Link
            to="/$market/host/create"
            params={{ market: market.slug }}
            search={{ city: undefined, state: undefined }}
            className="btn btn-secondary btn-sm rounded-full border-0"
            onClick={onDismiss}
          >
            {host_pick_city({}, { locale })}
          </Link>
        )}
      </div>
    </div>
  );
};
