import { useEffect, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_nearby_venues,
  host_search_results,
  host_venue_empty,
  host_venue_name_helper,
  host_venue_name_label,
  host_venue_name_ph,
  host_venue_no_results,
  host_venue_rate_limited,
  host_venue_search_error,
  type Locale,
} from '@founders-coffee/i18n';
import { Input } from '@founders-coffee/ui';

import { useNearbyVenues, useVenueSearch } from '../../features/events/hooks';
import type { VenueSelection } from '../../features/events/types';
import { HostVenueList, type VenueRow } from './HostVenueList';
import { VenueSearch } from './VenueSearch';

const SEARCH_DELAY_MS = 350;

type HostVenueStepProps = {
  locale: Locale;
  cityName: string;
  cityCode?: string;
  marketCode: string;
  center: { latitude: number; longitude: number };
  searchValue: string;
  venue: VenueSelection | null;
  venueName: string;
  nameError?: string;
  isDisabled: boolean;
  unavailableReason?: string;
  onSearchChange: (value: string) => void;
  onVenueNameChange: (value: string) => void;
  onVenueSelect: (venue: VenueSelection) => void;
};

export const HostVenueStep = ({
  locale,
  cityName,
  cityCode,
  marketCode,
  center,
  searchValue,
  venue,
  venueName,
  nameError,
  isDisabled,
  unavailableReason,
  onSearchChange,
  onVenueNameChange,
  onVenueSelect,
}: HostVenueStepProps) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(
      () => setQuery(searchValue.trim()),
      SEARCH_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [searchValue]);

  const nearby = useNearbyVenues({
    marketCode,
    latitude: center.latitude,
    longitude: center.longitude,
  });
  const search = useVenueSearch({
    marketCode,
    cityCode,
    locale,
    query: isDisabled ? '' : query,
  });

  const isSearching = query.length >= 2;
  const searchResults = isSearching ? (search.data ?? []) : [];
  const listed: readonly VenueRow[] = isSearching
    ? searchResults.map((result) => ({ ...result, eligible: true }))
    : (nearby.data ?? []);
  const isSelectionListed =
    venue != null &&
    listed.some((candidate) => candidate.providerId === venue.providerId);
  const rows: readonly VenueRow[] =
    venue && !isSelectionListed
      ? [{ ...venue, eligible: true }, ...listed]
      : listed;

  const errorCode = appErrorCode(search.error);
  const searchError =
    isSearching && search.isError
      ? errorCode === 'rate_limited'
        ? host_venue_rate_limited({}, { locale })
        : host_venue_search_error({}, { locale })
      : undefined;

  const listLabel = isSearching
    ? host_search_results({}, { locale })
    : host_nearby_venues({}, { locale });

  const emptyMessage = isSearching
    ? search.isFetching || search.isError
      ? undefined
      : host_venue_no_results({}, { locale })
    : nearby.isPending
      ? undefined
      : nearby.isError
        ? host_venue_search_error({}, { locale })
        : host_venue_empty({ city: cityName }, { locale });

  return (
    <div className="flex flex-col gap-3">
      <VenueSearch
        locale={locale}
        cityName={cityName}
        value={searchValue}
        isDisabled={isDisabled}
        isLoading={isSearching && search.isFetching}
        errorMessage={searchError}
        onChange={onSearchChange}
        onRetry={() => void search.refetch()}
      />
      {isDisabled && unavailableReason ? (
        <p className="text-body-sm text-error" role="alert">
          {unavailableReason}
        </p>
      ) : null}
      <div>
        <p className="mb-1.5 text-caption text-neutral">{listLabel}</p>
        {rows.length > 0 ? (
          <HostVenueList
            locale={locale}
            label={listLabel}
            venues={rows}
            selectedProviderId={venue?.providerId}
            showAttribution={!isSearching}
            onSelect={onVenueSelect}
          />
        ) : (
          emptyMessage && (
            <p className="text-body-sm text-neutral" role="status">
              {emptyMessage}
            </p>
          )
        )}
      </div>
      {venue?.kind === 'address' && (
        <label className="form-control" htmlFor="host-venue-name">
          <span className="mb-1 text-body-sm text-neutral">
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
            className="mt-1 text-caption text-neutral"
          >
            {host_venue_name_helper({}, { locale })}
          </span>
          {nameError && (
            <span
              id="host-venue-name-error"
              className="mt-1 text-body-sm text-error"
            >
              {nameError}
            </span>
          )}
        </label>
      )}
    </div>
  );
};
