import { MousePointerClick } from 'lucide-react';
import { lazy, Suspense } from 'react';

import { host_step1_helper, type Locale } from '@founders-coffee/i18n';

import type { VenueSelection } from '../../features/events/types';
import { ClientOnly } from './ClientOnly';

const VenueSearch = lazy(() =>
  import('./VenueSearch').then((m) => ({ default: m.VenueSearch })),
);

const SearchSkeleton = () => <div className="h-14 rounded-xl bg-base-200" />;

export const HostVenueStep = ({
  locale,
  cityName,
  cityCode,
  marketCode,
  searchValue,
  isDisabled,
  onSearchChange,
  onVenueSelect,
}: {
  locale: Locale;
  cityName: string;
  cityCode: string;
  marketCode: string;
  searchValue: string;
  isDisabled: boolean;
  onSearchChange: (value: string) => void;
  onVenueSelect: (venue: VenueSelection) => void;
}) => (
  <div className="mt-auto flex flex-col gap-3">
    <p className="flex items-start gap-2 text-sm text-base-content/50">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MousePointerClick className="size-4" aria-hidden="true" />
      </span>
      <span>{host_step1_helper({}, { locale })}</span>
    </p>
    <ClientOnly fallback={<SearchSkeleton />}>
      <Suspense fallback={<SearchSkeleton />}>
        <VenueSearch
          locale={locale}
          cityName={cityName}
          cityCode={cityCode}
          marketCode={marketCode}
          value={searchValue}
          isDisabled={isDisabled}
          onChange={onSearchChange}
          onVenueSelect={onVenueSelect}
        />
      </Suspense>
    </ClientOnly>
  </div>
);
