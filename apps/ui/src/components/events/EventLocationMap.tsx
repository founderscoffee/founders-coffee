import { MapPin, Navigation } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import {
  event_map_directions,
  event_map_directions_apple,
  event_map_directions_google,
  event_map_label,
  type Locale,
} from '@founders-coffee/i18n';

import mapboxLogo from '../../assets/mapbox-logo.svg';
import { directionsUrl, mapsAppFor, type MapsApp } from '../../lib/directions';
import { staticMapPicture } from '../../lib/static-map';
import { StaticMapCredits } from './StaticMapCredits';

type EventLocationMapProps = {
  locale: Locale;
  venue: string;
  latitude: number;
  longitude: number;
  mapboxToken: string | null;
};

const subscribeToNothing = () => () => undefined;

const deviceMapsApp = (): MapsApp => mapsAppFor(navigator.userAgent);

const serverMapsApp = (): MapsApp => 'google';

export const EventLocationMap = ({
  locale,
  venue,
  latitude,
  longitude,
  mapboxToken,
}: EventLocationMapProps) => {
  const app = useSyncExternalStore(
    subscribeToNothing,
    deviceMapsApp,
    serverMapsApp,
  );
  const point = { latitude, longitude };
  const picture = mapboxToken ? staticMapPicture(point, mapboxToken) : null;
  const directionsLabel =
    app === 'apple'
      ? event_map_directions_apple({ venue }, { locale })
      : event_map_directions_google({ venue }, { locale });

  return (
    <section aria-label={event_map_label({ venue }, { locale })}>
      <a
        href={directionsUrl(app, point)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={directionsLabel}
        className="group relative block h-56 overflow-hidden rounded-box bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:h-64 lg:h-72"
      >
        {picture ? (
          <>
            <picture>
              {picture.sources.map((source) => (
                <source
                  key={source.media}
                  media={source.media}
                  srcSet={source.srcSet}
                />
              ))}
              <img
                src={picture.src}
                srcSet={picture.srcSet}
                alt=""
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
            </picture>
            <img
              src={mapboxLogo}
              alt=""
              width={88}
              height={23}
              className="absolute bottom-2 start-2"
            />
          </>
        ) : null}
        <span className="absolute inset-0 flex items-center justify-center">
          <MapPin
            className="size-9 -translate-y-1/2 fill-secondary text-base-100 drop-shadow-md"
            aria-hidden="true"
          />
        </span>
        <span className="absolute end-3 top-3 flex">
          <span className="btn btn-xs sm:btn-sm md:btn-md gap-2 rounded-full border-base-300 bg-base-100 font-medium text-base-content shadow-lg backdrop-blur-md group-hover:bg-base-200">
            <Navigation className="size-4 shrink-0" aria-hidden="true" />
            {event_map_directions({}, { locale })}
          </span>
        </span>
      </a>
      {picture ? <StaticMapCredits locale={locale} /> : null}
    </section>
  );
};
