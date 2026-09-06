import { lazy, Suspense } from 'react';

import { host_map_error, host_retry, type Locale } from '@founders-coffee/i18n';
import { Button } from '@founders-coffee/ui';

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
  isError,
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
  isError: boolean;
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
          onVenueSelect={onVenueSelect}
          onVenueInvalidate={onVenueInvalidate}
          onCenterChange={onCenterChange}
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
        <HostMapSkeleton locale={locale} />
      )}
    </Suspense>
  </ClientOnly>
);
