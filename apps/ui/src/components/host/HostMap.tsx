import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';

import { appErrorCode } from '@founders-coffee/core';
import type { geo } from '@founders-coffee/domain';
import {
  host_geolocation_denied,
  host_map_error,
  host_map_label,
  host_venue_unsupported,
  type Locale,
} from '@founders-coffee/i18n';

import { useReverseEventVenue } from '../../features/events/hooks';
import type {
  HostMapViewport,
  VenueSelection,
} from '../../features/events/types';
import { loadMapboxCsp, MAPBOX_WORKER_URL } from '../../lib/mapbox-csp';
import { HostLocateButton } from './HostLocateButton';
import { HostLocationPrompt } from './HostLocationPrompt';
import { HostMapFailure } from './HostMapFailure';
import { HostMapSkeleton } from './HostMapSkeleton';
import { HostMapToasts } from './HostMapToasts';
import { HostSearchButton } from './HostSearchButton';
import { HostVenuePin } from './HostVenuePin';
import { LOCATE_ZOOM, VENUE_ZOOM, zoomForTap } from './mapZoom';
import type { ControlSize } from './useControlSize';
import { useLocationPrompt } from './useLocationPrompt';
import { initialCamera, useMapCover } from './useMapCover';
import { useMapResize } from './useMapResize';
import { useVisitorLocation, type Coordinates } from './useVisitorLocation';

const MAP_STYLE = 'mapbox://styles/mapbox/standard-satellite';

const mapLib = loadMapboxCsp();

type HostMapProps = {
  accessToken: string;
  venue: VenueSelection | null;
  viewport: HostMapViewport;
  cityCode?: string;
  marketCode: string;
  locale: Locale;
  isInteractive?: boolean;
  covered?: number;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
  onCenterChange?: (center: Coordinates) => void;
  onUserMove?: () => void;
  onUserGestureEnd?: () => void;
  onLocateResize?: (size: ControlSize | null) => void;
  onCitySelect?: (city: geo.GeoCity) => void;
  onSearch?: () => void;
};

export const HostMap = ({
  accessToken,
  venue,
  viewport,
  cityCode,
  marketCode,
  locale,
  isInteractive = true,
  covered = 0,
  onVenueSelect,
  onVenueInvalidate,
  onCenterChange,
  onUserMove,
  onUserGestureEnd,
  onLocateResize,
  onCitySelect,
  onSearch,
}: HostMapProps) => {
  const mapRef = useRef<MapboxMap | null>(null);
  const reverseRequestId = useRef(0);
  const placedByHost = useRef<Coordinates | null>(null);
  const isHostMoving = useRef(false);
  const isStillInteractive = useRef(isInteractive);
  isStillInteractive.current = isInteractive;
  const reverseVenue = useReverseEventVenue();
  const visitor = useVisitorLocation();
  const [mapKey, setMapKey] = useState(0);
  const [isMapReady, setIsMapReady] = useState(false);
  const [hasMapError, setHasMapError] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [lastCoordinates, setLastCoordinates] = useState<Coordinates | null>(
    null,
  );
  const prompt = useLocationPrompt({
    canAsk: isInteractive && onCitySelect !== undefined,
    hasCity: cityCode !== undefined,
    hasVenue: venue !== null,
  });
  const cameraPadding = useMapCover(mapRef, covered, viewport, venue);
  const frameRef = useMapResize(mapRef);
  const flyTo = (longitude: number, latitude: number, zoom: number): void => {
    mapRef.current?.flyTo({
      center: [longitude, latitude],
      zoom,
      duration: 1_000,
      padding: cameraPadding(),
    });
  };

  const pin = venue ?? (reverseVenue.isPending ? lastCoordinates : null);

  const resolveCoordinates = async (
    coordinates: Coordinates,
  ): Promise<void> => {
    const requestId = reverseRequestId.current + 1;
    reverseRequestId.current = requestId;
    placedByHost.current = coordinates;
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
      const isNothingThere = appErrorCode(error) === 'map_venue_not_found';
      if (isNothingThere && prompt.askAfterMiss()) return;
      setLocationError(
        isNothingThere
          ? host_venue_unsupported({}, { locale })
          : host_map_error({}, { locale }),
      );
    }
  };

  const chooseWhereVisitorIs = async (): Promise<void> => {
    const requestId = reverseRequestId.current;
    setLocationError(null);
    const coordinates = await visitor.locate();
    if (requestId !== reverseRequestId.current || !isStillInteractive.current) {
      return;
    }
    if (!coordinates) {
      setLocationError(host_geolocation_denied({}, { locale }));
      return;
    }
    flyTo(coordinates.longitude, coordinates.latitude, LOCATE_ZOOM);
    void resolveCoordinates(coordinates);
    onUserGestureEnd?.();
  };

  useEffect(() => {
    if (!venue) return;
    const placed = placedByHost.current;
    placedByHost.current = null;
    if (
      placed?.longitude === venue.longitude &&
      placed.latitude === venue.latitude
    ) {
      return;
    }
    reverseRequestId.current += 1;
    flyTo(venue.longitude, venue.latitude, VENUE_ZOOM);
  }, [venue?.providerId, venue?.longitude, venue?.latitude]);

  if (hasMapError) {
    return (
      <HostMapFailure
        locale={locale}
        onRetry={() => {
          setHasMapError(false);
          setIsMapReady(false);
          setMapKey((value) => value + 1);
        }}
      />
    );
  }

  return (
    <div
      ref={frameRef}
      className="relative h-full min-h-64 w-full overflow-hidden"
      aria-label={host_map_label({}, { locale })}
    >
      <Map
        key={mapKey}
        ref={mapRef as never}
        initialViewState={initialCamera(venue, viewport, covered, VENUE_ZOOM)}
        onLoad={() => setIsMapReady(true)}
        onMoveStart={(event) => {
          if (!('originalEvent' in event && event.originalEvent)) return;
          isHostMoving.current = true;
          onUserMove?.();
        }}
        onMoveEnd={(event) => {
          onCenterChange?.({
            latitude: event.viewState.latitude,
            longitude: event.viewState.longitude,
          });
          if (!isHostMoving.current) return;
          isHostMoving.current = false;
          onUserGestureEnd?.();
        }}
        onClick={
          isInteractive
            ? (event) => {
                const { lng, lat } = event.lngLat;
                const closer = zoomForTap(event.target.getZoom());
                if (closer === null) {
                  void resolveCoordinates({ longitude: lng, latitude: lat });
                } else {
                  flyTo(lng, lat, closer);
                }
                onUserGestureEnd?.();
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
              onUserGestureEnd?.();
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
        <HostLocateButton
          locale={locale}
          onResize={onLocateResize}
          onClick={() => void chooseWhereVisitorIs()}
        />
      )}

      {isInteractive && onSearch && (
        <HostSearchButton locale={locale} onClick={onSearch} />
      )}

      <HostMapToasts
        locale={locale}
        isResolving={reverseVenue.isPending || visitor.isFinding}
        error={locationError}
        onDismiss={() => setLocationError(null)}
        onRetry={
          lastCoordinates
            ? () => void resolveCoordinates(lastCoordinates)
            : undefined
        }
      />

      {onCitySelect && (
        <HostLocationPrompt
          locale={locale}
          marketCode={marketCode}
          cityCode={cityCode}
          reason={prompt.reason}
          onLocate={() => void chooseWhereVisitorIs()}
          onCitySelect={onCitySelect}
          onClose={prompt.close}
        />
      )}
    </div>
  );
};
