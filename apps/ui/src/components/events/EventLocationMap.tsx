import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';

import {
  event_map_label,
  event_map_loading,
  type Locale,
} from '@founders-coffee/i18n';

import { useMapboxToken } from '../../features/events/hooks';
import { loadMapboxCsp, MAPBOX_WORKER_URL } from '../../lib/mapbox-csp';

const MAP_STYLE = 'mapbox://styles/mapbox/standard-satellite';
const mapLib = loadMapboxCsp();

const MapSkeleton = ({ locale }: { locale: Locale }) => (
  <div className="absolute inset-0 z-20">
    <div
      className="skeleton size-full rounded-none motion-reduce:animate-none"
      role="status"
      aria-label={event_map_loading({}, { locale })}
    />
  </div>
);

type EventLocationMapProps = {
  locale: Locale;
  venue: string;
  latitude: number;
  longitude: number;
};

export const EventLocationMap = ({
  locale,
  venue,
  latitude,
  longitude,
}: EventLocationMapProps) => {
  const mapboxToken = useMapboxToken();
  const [hasMapError, setHasMapError] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const locationLabel = event_map_label({ venue }, { locale });

  return (
    <section
      aria-label={locationLabel}
      className="overflow-hidden rounded-box bg-base-200"
    >
      <div className="relative h-56 bg-base-200 sm:h-64 lg:h-72">
        {mapboxToken.data && !hasMapError ? (
          <>
            <Map
              initialViewState={{ longitude, latitude, zoom: 14.5 }}
              mapLib={mapLib as never}
              workerUrl={MAPBOX_WORKER_URL}
              mapboxAccessToken={mapboxToken.data}
              mapStyle={MAP_STYLE}
              interactive={false}
              attributionControl
              onError={() => setHasMapError(true)}
              onLoad={() => setIsMapReady(true)}
              style={{ width: '100%', height: '100%' }}
            >
              <Marker longitude={longitude} latitude={latitude} anchor="bottom">
                <MapPin
                  className="size-9 fill-secondary text-base-100 drop-shadow-md"
                  aria-hidden="true"
                />
              </Marker>
            </Map>
            {!isMapReady && <MapSkeleton locale={locale} />}
          </>
        ) : (
          <div className="flex size-full items-center justify-center">
            <MapPin
              className="size-10 fill-secondary text-base-100"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </section>
  );
};
