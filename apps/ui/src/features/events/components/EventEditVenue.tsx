import { useState } from 'react';

import { host_edit_venue_hint, type Locale } from '@founders-coffee/i18n';
import type { EventDetailItem } from '@founders-coffee/server-fns';

import { HostMapPanel } from '../../../components/host/HostMapPanel';
import { HostVenueStep } from '../../../components/host/HostVenueStep';
import { eventCityName } from '../event-city-name';
import { useHostMapContext } from '../hooks';
import { seekPlaceOrSearch } from '../seek-field';
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
  const cityName = eventCityName(event, locale);
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
          error={mapContext.error}
          isInteractive
          onRetry={() => void mapContext.refetch()}
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onCenterChange={setCenter}
          onMiss={seekPlaceOrSearch}
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
        onSearchChange={onSearchChange}
        onVenueNameChange={() => undefined}
        onVenueSelect={onVenueSelect}
      />
    </div>
  );
};
