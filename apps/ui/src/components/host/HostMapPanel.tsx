import { lazy, Suspense } from 'react';

import { appErrorCode } from '@founders-coffee/core';
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
  onRetry,
  onVenueSelect,
  onVenueInvalidate,
  onCenterChange,
}: {
  locale: Locale;
  accessToken: string;
  marketCode: string;
  cityCode?: string;
  venue: VenueSelection | null;
  viewport: React.ComponentProps<typeof HostMap>['viewport'] | undefined;
  error: unknown;
  isInteractive: boolean;
  onRetry: () => void;
  onVenueSelect: (venue: VenueSelection) => void;
  onVenueInvalidate: () => void;
  onCenterChange?: (center: { latitude: number; longitude: number }) => void;
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
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onCenterChange={onCenterChange}
        />
      ) : error ? (
        <div className="flex h-full min-h-64 items-center justify-center bg-base-200 p-6">
          <StatusMessage
            variant="error"
            action={
              <Button variant="outline" size="sm" onClick={onRetry}>
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
