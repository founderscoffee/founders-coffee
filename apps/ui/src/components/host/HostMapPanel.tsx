import { lazy, Suspense } from 'react';

import {
  host_map_error,
  host_map_loading,
  host_retry,
  type Locale,
} from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

import type { VenueSelection } from '../../features/events/types';
import { ClientOnly } from './ClientOnly';

const HostMap = lazy(() =>
  import('./HostMap').then((m) => ({ default: m.HostMap })),
);

const MapSkeleton = () => (
  <div className="h-full min-h-64 w-full bg-base-200" />
);

export const HostMapPanel = ({
  locale,
  accessToken,
  marketCode,
  cityCode,
  venue,
  viewport,
  isError,
  onRetry,
  onVenueSelect,
  onVenueInvalidate,
  onLocatedOutsideCity,
}: {
  locale: Locale;
  accessToken: string;
  marketCode: string;
  cityCode: string;
  venue: VenueSelection | null;
  viewport: React.ComponentProps<typeof HostMap>['viewport'] | undefined;
  isError: boolean;
  onRetry: () => void;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
  onLocatedOutsideCity: (coordinates: {
    latitude: number;
    longitude: number;
  }) => void;
}) => (
  <ClientOnly fallback={<MapSkeleton />}>
    <Suspense fallback={<MapSkeleton />}>
      {viewport ? (
        <HostMap
          accessToken={accessToken}
          venue={venue}
          viewport={viewport}
          cityCode={cityCode}
          marketCode={marketCode}
          locale={locale}
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onLocatedOutsideCity={onLocatedOutsideCity}
        />
      ) : isError ? (
        <div className="flex h-full min-h-64 flex-col items-center justify-center gap-4 bg-error-tint p-6 text-center">
          <p className="text-sm text-error" role="alert">
            {host_map_error({}, { locale })}
          </p>
          <Button variant="outline" onClick={onRetry}>
            {host_retry({}, { locale })}
          </Button>
        </div>
      ) : (
        <div
          className="flex h-full min-h-64 items-center justify-center bg-base-200"
          role="status"
        >
          <span className="loading loading-spinner me-2" />
          {host_map_loading({}, { locale })}
        </div>
      )}
    </Suspense>
  </ClientOnly>
);
