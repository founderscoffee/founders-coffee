import { Crosshair, Minus, Plus, RefreshCw } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_geolocation_denied,
  host_locate_me,
  host_map_error,
  host_map_label,
  host_retry,
  host_selected_location,
  host_venue_outside_city,
  host_venue_resolving,
  host_venue_unsupported,
  host_zoom_in,
  host_zoom_out,
  type Locale,
} from '@founders-coffee/i18n';

import { useReverseEventVenue } from '../../features/events/hooks';
import type {
  HostMapViewport,
  VenueSelection,
} from '../../features/events/types';
import { loadMapboxCsp, MAPBOX_WORKER_URL } from '../../lib/mapbox-csp';

const MAP_STYLE = 'mapbox://styles/mapbox/standard';

const mapLib = loadMapboxCsp();

type Coordinates = { longitude: number; latitude: number };

type HostMapProps = {
  accessToken: string;
  venue: VenueSelection | null;
  viewport: HostMapViewport;
  cityCode: string;
  marketCode: string;
  locale: Locale;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
};

const locateVisitor = (): Promise<Coordinates | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6_000 },
    );
  });

const CONTROL_CLASS =
  'flex h-11 w-11 items-center justify-center rounded-xl border border-base-300 bg-base-100 text-base-content shadow-lg backdrop-blur-md transition hover:scale-105 hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-secondary';

export const HostMap = ({
  accessToken,
  venue,
  viewport,
  cityCode,
  marketCode,
  locale,
  onVenueSelect,
  onVenueInvalidate,
}: HostMapProps) => {
  const mapRef = useRef<MapboxMap | null>(null);
  const reverseRequestId = useRef(0);
  const reverseVenue = useReverseEventVenue();
  const [mapKey, setMapKey] = useState(0);
  const [hasMapError, setHasMapError] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCoordinates, setLastCoordinates] = useState<Coordinates | null>(
    null,
  );

  const flyTo = (longitude: number, latitude: number, zoom: number): void => {
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom,
      duration: 1_000,
    });
  };

  const venueErrorMessage = (error: unknown): string => {
    const code = appErrorCode(error);
    return code === 'map_venue_outside_city'
      ? host_venue_outside_city({}, { locale })
      : code === 'map_venue_unsupported'
        ? host_venue_unsupported({}, { locale })
        : host_map_error({}, { locale });
  };

  const resolveCoordinates = async (
    coordinates: Coordinates,
  ): Promise<void> => {
    const requestId = reverseRequestId.current + 1;
    reverseRequestId.current = requestId;
    setLastCoordinates(coordinates);
    setLocationError(null);
    onVenueInvalidate();
    try {
      const resolved = await reverseVenue.mutateAsync({
        marketCode,
        cityCode,
        locale,
        ...coordinates,
      });
      if (requestId !== reverseRequestId.current) return;
      onVenueSelect(resolved);
    } catch (error) {
      if (requestId !== reverseRequestId.current) return;
      setLocationError(venueErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!venue) return;
    reverseRequestId.current += 1;
    flyTo(venue.longitude, venue.latitude, 15);
  }, [venue?.providerId, venue?.longitude, venue?.latitude]);

  if (hasMapError) {
    return (
      <div className="flex min-h-80 w-full flex-col items-center justify-center gap-4 rounded-2xl border border-error bg-error-tint p-6 text-center md:min-h-96">
        <p className="text-body-sm text-error" role="alert">
          {host_map_error({}, { locale })}
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            setHasMapError(false);
            setMapKey((value) => value + 1);
          }}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {host_retry({}, { locale })}
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative h-44 w-full overflow-hidden rounded-box border border-base-300 shadow-[var(--shadow-2)] md:h-[clamp(20rem,50vh,30rem)]"
      aria-label={host_map_label({}, { locale })}
    >
      <Map
        key={mapKey}
        ref={mapRef as never}
        initialViewState={{
          longitude: venue?.longitude ?? viewport.center.longitude,
          latitude: venue?.latitude ?? viewport.center.latitude,
          zoom: venue ? 15 : 11,
        }}
        maxBounds={[
          [viewport.bounds[0], viewport.bounds[1]],
          [viewport.bounds[2], viewport.bounds[3]],
        ]}
        onClick={(event) => {
          const { lng, lat } = event.lngLat;
          void resolveCoordinates({ longitude: lng, latitude: lat });
        }}
        onError={(e) => {
          console.error(
            'MAPERR',
            (e as never as { error?: Error }).error?.message,
            (e as never as { error?: Error }).error?.stack,
          );
          setHasMapError(true);
        }}
        mapLib={mapLib as never}
        workerUrl={MAPBOX_WORKER_URL}
        mapboxAccessToken={accessToken}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        {venue && (
          <Marker
            longitude={venue.longitude}
            latitude={venue.latitude}
            draggable
            anchor="bottom"
            onDragEnd={(event) => {
              void resolveCoordinates({
                longitude: event.lngLat.lng,
                latitude: event.lngLat.lat,
              });
            }}
          >
            <div className="host-pin">
              <div className="host-pin-pulse flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-primary text-body shadow-xl"></div>
            </div>
          </Marker>
        )}
      </Map>

      <div className="absolute end-3 top-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className={CONTROL_CLASS}
          aria-label={host_zoom_in({}, { locale })}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className={CONTROL_CLASS}
          aria-label={host_zoom_out({}, { locale })}
        >
          <Minus className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={async () => {
            setLocationError(null);
            const coordinates = await locateVisitor();
            if (coordinates) {
              flyTo(coordinates.longitude, coordinates.latitude, 14);
            } else {
              setLocationError(host_geolocation_denied({}, { locale }));
            }
          }}
          className={CONTROL_CLASS}
          aria-label={host_locate_me({}, { locale })}
          title={host_locate_me({}, { locale })}
        >
          <Crosshair className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {reverseVenue.isPending && (
        <p
          className="absolute inset-x-3 top-3 me-14 rounded-xl bg-base-100 p-3 text-body-sm shadow-lg backdrop-blur-md"
          role="status"
        >
          <span className="loading loading-spinner loading-xs me-2" />
          {host_venue_resolving({}, { locale })}
        </p>
      )}

      {locationError && (
        <div
          className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-xl border border-error bg-base-100 p-3 shadow-lg"
          role="alert"
        >
          <span className="text-body-sm text-error">{locationError}</span>
          {lastCoordinates && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void resolveCoordinates(lastCoordinates)}
            >
              {host_retry({}, { locale })}
            </button>
          )}
        </div>
      )}

      {venue && !locationError && !reverseVenue.isPending && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 md:start-4 md:end-auto md:max-w-xs">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-xl backdrop-blur-md">
            <p className="text-caption font-medium text-neutral">
              {host_selected_location({}, { locale })}
            </p>
            <p className="mt-0.5 line-clamp-1 text-body-sm font-bold text-base-content">
              {venue.name}
            </p>
            <p className="line-clamp-1 text-caption text-neutral">
              {venue.address}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
