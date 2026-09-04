import { MousePointerClick } from 'lucide-react';
import { lazy, Suspense } from 'react';

import {
  host_step1_helper,
  host_venue_name_helper,
  host_venue_name_label,
  host_venue_name_ph,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

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
  venue,
  venueName,
  nameError,
  isDisabled,
  unavailableReason,
  onSearchChange,
  onVenueNameChange,
  onVenueSelect,
}: {
  locale: Locale;
  cityName: string;
  cityCode: string;
  marketCode: string;
  searchValue: string;
  venue: VenueSelection | null;
  venueName: string;
  nameError?: string;
  isDisabled: boolean;
  unavailableReason?: string;
  onSearchChange: (value: string) => void;
  onVenueNameChange: (value: string) => void;
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
    {isDisabled && unavailableReason ? (
      <p className="text-body-sm text-error" role="alert">
        {unavailableReason}
      </p>
    ) : null}
    {venue?.kind === 'address' && (
      <label className="form-control" htmlFor="host-venue-name">
        <span className="mb-1 text-sm text-base-content/70">
          {host_venue_name_label({}, { locale })}
        </span>
        <Input
          id="host-venue-name"
          value={venueName}
          maxLength={200}
          placeholder={host_venue_name_ph({}, { locale })}
          aria-invalid={!!nameError}
          aria-describedby="host-venue-name-help host-venue-name-error"
          onChange={(event) => onVenueNameChange(event.target.value)}
        />
        <span
          id="host-venue-name-help"
          className="mt-1 text-xs text-base-content/50"
        >
          {host_venue_name_helper({}, { locale })}
        </span>
        {nameError && (
          <span id="host-venue-name-error" className="mt-1 text-sm text-error">
            {nameError}
          </span>
        )}
      </label>
    )}
  </div>
);
