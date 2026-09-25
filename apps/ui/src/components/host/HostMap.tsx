import { Crosshair, RefreshCw } from 'lucide-react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_geolocation_denied,
  host_locate_me,
  host_map_error,
  host_map_label,
  retry,
  host_venue_unsupported,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { useReverseEventVenue } from '../../features/events/hooks';
import type {
  HostMapViewport,
  VenueSelection,
} from '../../features/events/types';
import { loadMapboxCsp, MAPBOX_WORKER_URL } from '../../lib/mapbox-csp';
import { CALLOUT_GAP } from './callout-placement';
import { HostMapSkeleton } from './HostMapSkeleton';
import { HostMapToasts } from './HostMapToasts';
import { HostVenueCallout } from './HostVenueCallout';
import { HostVenuePin } from './HostVenuePin';
import { useCalloutPlacement } from './useCalloutPlacement';

const MAP_STYLE = 'mapbox://styles/mapbox/standard-satellite';

const mapLib = loadMapboxCsp();

type Coordinates = { longitude: number; latitude: number };

type HostMapProps = {
  accessToken: string;
  venue: VenueSelection | null;
  viewport: HostMapViewport;
  cityCode?: string;
  marketCode: string;
  locale: Locale;
  isInteractive?: boolean;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
  onCenterChange?: (center: Coordinates) => void;
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
  'flex h-11 items-center gap-2 rounded-full border border-base-300 bg-base-100 px-4 text-body-sm font-medium text-base-content shadow-lg backdrop-blur-md transition hover:bg-base-200 focus-visible:ring-2 focus-visible:ring-secondary motion-reduce:transition-none';

export const HostMap = ({
  accessToken,
  venue,
  viewport,
  cityCode,
  marketCode,
  locale,
  isInteractive = true,
  onVenueSelect,
  onVenueInvalidate,
  onCenterChange,
}: HostMapProps) => {
  const mapRef = useRef<MapboxMap | null>(null);
  const reverseRequestId = useRef(0);
  const placedByHost = useRef(false);
  const reverseVenue = useReverseEventVenue();
  const [mapKey, setMapKey] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
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

  const pin = venue ?? (reverseVenue.isPending ? lastCoordinates : null);
  const callout = useCalloutPlacement(mapRef, venue);

  const venueErrorMessage = (error: unknown): string =>
    appErrorCode(error) === 'map_venue_unsupported'
      ? host_venue_unsupported({}, { locale })
      : host_map_error({}, { locale });

  const resolveCoordinates = async (
    coordinates: Coordinates,
  ): Promise<void> => {
    const requestId = reverseRequestId.current + 1;
    reverseRequestId.current = requestId;
    placedByHost.current = true;
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
      onVenueSelect({ ...resolved, ...coordinates });
    } catch (error) {
      if (requestId !== reverseRequestId.current) return;
      setLocationError(venueErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!venue) return;
    if (placedByHost.current) {
      placedByHost.current = false;
      return;
    }
    reverseRequestId.current += 1;
    flyTo(venue.longitude, venue.latitude, 15);
  }, [venue?.providerId, venue?.longitude, venue?.latitude]);

  if (hasMapError) {
    return (
      <div className="flex h-full min-h-64 w-full items-center justify-center bg-base-200 p-6">
        <StatusMessage
          variant="error"
          action={
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setHasMapError(false);
                setIsMapReady(false);
                setMapKey((value) => value + 1);
              }}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              {retry({}, { locale })}
            </button>
          }
        >
          {host_map_error({}, { locale })}
        </StatusMessage>
      </div>
    );
  }

  return (
    <div
      className="relative h-full min-h-64 w-full overflow-hidden"
      aria-label={host_map_label({}, { locale })}
    >
      <Map
        key={mapKey}
        ref={mapRef as never}
        initialViewState={
          venue
            ? { longitude: venue.longitude, latitude: venue.latitude, zoom: 15 }
            : {
                bounds: [
                  [viewport.bounds[0], viewport.bounds[1]],
                  [viewport.bounds[2], viewport.bounds[3]],
                ],
                fitBoundsOptions: { padding: 24 },
              }
        }
        onLoad={() => setIsMapReady(true)}
        onMove={callout.sync}
        onMoveEnd={(event) =>
          onCenterChange?.({
            latitude: event.viewState.latitude,
            longitude: event.viewState.longitude,
          })
        }
        onClick={
          isInteractive
            ? (event) => {
                const { lng, lat } = event.lngLat;
                void resolveCoordinates({ longitude: lng, latitude: lat });
              }
            : undefined
        }
        onError={() => setHasMapError(true)}
        mapLib={mapLib as never}
        workerUrl={MAPBOX_WORKER_URL}
        mapboxAccessToken={accessToken}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
      >
        {venue && !locationError && !reverseVenue.isPending && (
          <Marker
            longitude={venue.longitude}
            latitude={venue.latitude}
            anchor="top"
            offset={[0, CALLOUT_GAP]}
            style={{ pointerEvents: 'none' }}
          >
            <HostVenueCallout
              venue={venue}
              locale={locale}
              above={callout.above}
              showHint={isInteractive}
              ref={callout.measure}
            />
          </Marker>
        )}

        {pin && (
          <Marker
            longitude={pin.longitude}
            latitude={pin.latitude}
            draggable={isInteractive}
            anchor="bottom"
            onDragEnd={(event) => {
              if (!isInteractive) return;
              void resolveCoordinates({
                longitude: event.lngLat.lng,
                latitude: event.lngLat.lat,
              });
            }}
          >
            <HostVenuePin />
          </Marker>
        )}
      </Map>

      {!isMapReady && (
        <div className="absolute inset-0 z-20">
          <HostMapSkeleton locale={locale} />
        </div>
      )}

      {isInteractive && (
        <div className="absolute start-3 top-3">
          <button
            type="button"
            onClick={async () => {
              setLocationError(null);
              const coordinates = await locateVisitor();
              if (!coordinates) {
                setLocationError(host_geolocation_denied({}, { locale }));
                return;
              }
              flyTo(coordinates.longitude, coordinates.latitude, 14);
            }}
            className={CONTROL_CLASS}
          >
            <Crosshair className="size-4 shrink-0" aria-hidden="true" />
            {host_locate_me({}, { locale })}
          </button>
        </div>
      )}

      <HostMapToasts
        locale={locale}
        isResolving={reverseVenue.isPending}
        error={locationError}
        onRetry={
          lastCoordinates
            ? () => void resolveCoordinates(lastCoordinates)
            : undefined
        }
      />
    </div>
  );
};
