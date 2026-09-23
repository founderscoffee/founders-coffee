import { useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_edit_venue_hint,
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { HostMapPanel } from '../../../components/host/HostMapPanel';
import { HostVenueStep } from '../../../components/host/HostVenueStep';
import { useHostMapContext } from '../hooks';
import type { VenueSelection } from '../types';

type Coordinates = { latitude: number; longitude: number };

export const EventEditVenue = ({
  locale,
  event,
  mapboxToken,
  venue,
  searchValue,
  onSearchChange,
  onVenueSelect,
  onVenueInvalidate,
}: {
  locale: Locale;
  event: EventDetailItem;
  mapboxToken: string;
  venue: VenueSelection | null;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
}) => {
  const [center, setCenter] = useState<Coordinates | null>(null);
  const mapContext = useHostMapContext({
    marketCode: event.marketCode,
    cityCode: event.cityCode,
    locale,
  });
  const mapContextError = mapContext.isError
    ? appErrorCode(mapContext.error) === 'rate_limited'
      ? host_venue_rate_limited({}, { locale })
      : host_venue_search_error({}, { locale })
    : undefined;
  const cityName =
    locale === 'ar' ? event.cityNameAr : (event.cityName ?? event.cityNameAr);
  const listCenter = center ??
    venue ??
    mapContext.data?.center ?? { latitude: 0, longitude: 0 };

  return (
    <div className="grid gap-3">
      <div className="h-72 overflow-hidden rounded-box border border-base-300">
        <HostMapPanel
          locale={locale}
          accessToken={mapboxToken}
          marketCode={event.marketCode}
          cityCode={event.cityCode}
          venue={venue}
          viewport={mapContext.data}
          isError={mapContext.isError}
          isInteractive
          onRetry={() => void mapContext.refetch()}
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onCenterChange={setCenter}
        />
      </div>
      <p className="text-caption text-neutral">
        {host_edit_venue_hint({}, { locale })}
      </p>
      <HostVenueStep
        locale={locale}
        area={{ kind: 'city', name: cityName }}
        cityCode={event.cityCode}
        marketCode={event.marketCode}
        center={listCenter}
        searchValue={searchValue}
        venue={venue}
        venueName={event.venue}
        hideNameField
        boundedList
        isDisabled={!mapContext.data}
        unavailableReason={mapContextError}
        onSearchChange={onSearchChange}
        onVenueNameChange={() => undefined}
        onVenueSelect={onVenueSelect}
      />
    </div>
  );
};
