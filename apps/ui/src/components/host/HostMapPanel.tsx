import { lazy, Suspense } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import type { geo } from '@founders-coffee/domain';
import {
  host_map_error,
  host_venue_rate_limited,
  retry,
  type Locale,
} from '@founders-coffee/i18n';
import { Button, StatusMessage } from '@founders-coffee/ui';

import type { VenueSelection } from '../../features/events/types';
import { ClientOnly } from './ClientOnly';
import { HostMapSkeleton } from './HostMapSkeleton';
import type { ControlSize } from './useControlSize';

const HostMap = lazy(() =>
  import('./HostMap').then((m) => ({ default: m.HostMap })),
);

export const HostMapPanel = ({
  locale,
  accessToken,
  marketCode,
  cityCode,
  venue,
  viewport,
  error,
  isInteractive,
  covered,
  onRetry,
  onVenueSelect,
  onVenueInvalidate,
  onCenterChange,
  onUserMove,
  onUserGestureEnd,
  onLocateResize,
  onCitySelect,
  onSearch,
}: {
  locale: Locale;
  accessToken: string;
  marketCode: string;
  cityCode?: string;
  venue: VenueSelection | null;
  viewport: React.ComponentProps<typeof HostMap>['viewport'] | undefined;
  error: unknown;
  isInteractive: boolean;
  covered?: number;
  onRetry: () => void;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
  onCenterChange?: (center: { latitude: number; longitude: number }) => void;
  onUserMove?: () => void;
  onUserGestureEnd?: () => void;
  onLocateResize?: (size: ControlSize | null) => void;
  onCitySelect?: (city: geo.GeoCity) => void;
  onSearch?: () => void;
}) => (
  <ClientOnly fallback={<HostMapSkeleton locale={locale} />}>
    <Suspense fallback={<HostMapSkeleton locale={locale} />}>
      {viewport ? (
        <HostMap
          accessToken={accessToken}
          venue={venue}
          viewport={viewport}
          cityCode={cityCode}
          marketCode={marketCode}
          locale={locale}
          isInteractive={isInteractive}
          covered={covered}
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onCenterChange={onCenterChange}
          onUserMove={onUserMove}
          onUserGestureEnd={onUserGestureEnd}
          onLocateResize={onLocateResize}
          onCitySelect={onCitySelect}
          onSearch={onSearch}
        />
      ) : error ? (
        <div className="flex h-full min-h-64 items-center justify-center bg-base-200 p-6">
          <StatusMessage
            variant="error"
            action={
              <Button variant="outline" onClick={onRetry}>
                {retry({}, { locale })}
              </Button>
            }
          >
            {appErrorCode(error) === 'rate_limited'
              ? host_venue_rate_limited({}, { locale })
              : host_map_error({}, { locale })}
          </StatusMessage>
        </div>
      ) : (
        <HostMapSkeleton locale={locale} />
      )}
    </Suspense>
  </ClientOnly>
);
