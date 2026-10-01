import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { geo } from '@founders-coffee/domain';
import {
  host_nearby_venues,
  host_search_results,
  host_search_venues,
  host_selected_location,
  host_venue_browse_nearby,
  host_venue_empty,
  host_venue_no_results,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { useNearbyVenues, useVenueSearch } from '../../features/events/hooks';
import {
  VENUE_SEARCH_INPUT_ID,
  type VenueArea,
  type VenueSelection,
} from '../../features/events/types';
import { CitySuggestions } from './CitySuggestions';
import { HostMapButton } from './HostMapButton';
import { HostVenueChoice } from './HostVenueChoice';
import { HostVenueList, type VenueRow } from './HostVenueList';
import { HostVenueNameField } from './HostVenueNameField';
import type { ControlSize } from './useControlSize';
import { useDismissOnPointerOutside } from './useDismissOnPointerOutside';
import { useVenueNotices, type VenueError } from './useVenueNotices';
import { VenueResultsPanel } from './VenueResultsPanel';
import { VenueSearch } from './VenueSearch';
import { VenueStepToasts } from './VenueStepToasts';

const SEARCH_DELAY_MS = 350;

const VENUE_LIST_ID = 'venue-results';

export type VenueOverlay = {
  readonly isCollapsed: boolean;
  readonly isExploring?: boolean;
  readonly neighbour?: ControlSize | null;
  readonly onToggle: () => void;
  readonly onCoverChange: (height: number) => void;
  readonly onDismiss: () => void;
  readonly onSearch?: () => void;
};

type HostVenueStepProps = {
  locale: Locale;
  area: VenueArea;
  cityCode?: string;
  marketCode: string;
  center: { latitude: number; longitude: number };
  searchValue: string;
  venue: VenueSelection | null;
  venueName: string;
  nameError?: string;
  venueError?: VenueError;
  hideNameField?: boolean;
  boundedList?: boolean;
  overlay?: VenueOverlay;
  isDisabled: boolean;
  onSearchChange: (value: string) => void;
  onVenueNameChange: (value: string) => void;
  onVenueSelect: (venue: VenueSelection) => void;
  onCitySelect?: (city: geo.GeoCity) => void;
};

export const HostVenueStep = ({
  locale,
  area,
  cityCode,
  marketCode,
  center,
  searchValue,
  venue,
  venueName,
  nameError,
  venueError,
  hideNameField = false,
  boundedList = false,
  overlay,
  isDisabled,
  onSearchChange,
  onVenueNameChange,
  onVenueSelect,
  onCitySelect,
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

  const [isBrowsingNearby, setIsBrowsingNearby] = useState(false);

  useEffect(() => setIsBrowsingNearby(false), [venue?.providerId]);

  const isSearching = query.length >= 2;
  const searchResults = isSearching ? (search.data ?? []) : [];
  const listed: readonly VenueRow[] = isSearching
    ? searchResults.map((result) => ({ ...result, eligible: true }))
    : (nearby.data ?? []);
  const isSelectionListed =
    venue != null &&
    listed.some((candidate) => candidate.providerId === venue.providerId);
  const isPinned =
    venue?.kind === 'address' && !isSearching && !isBrowsingNearby;
  const rows: readonly VenueRow[] = isPinned
    ? [{ ...venue, eligible: true }]
    : venue && !isSelectionListed
      ? [{ ...venue, eligible: true }, ...listed]
      : listed;

  const isHintOnly = rows.length === 0 && !isSearching;
  const isHintBesideLocate = overlay !== undefined && isHintOnly;
  const isExploring = overlay?.isExploring === true;

  const pickerRef = useRef<HTMLDivElement>(null);
  useDismissOnPointerOutside(
    pickerRef,
    overlay !== undefined && !overlay.isCollapsed && !isHintOnly,
    () => overlay?.onDismiss(),
  );

  const notices = useVenueNotices({
    locale,
    lookup: isSearching ? search : nearby,
    venueError,
  });

  const listLabel = isSearching
    ? host_search_results({}, { locale })
    : isPinned
      ? host_selected_location({}, { locale })
      : host_nearby_venues({}, { locale });

  const emptyMessage =
    isSearching && !search.isError
      ? search.isFetching
        ? undefined
        : host_venue_no_results({}, { locale })
      : !isSearching && nearby.isPending
        ? undefined
        : host_venue_empty({}, { locale });

  const chooseCity = (city: geo.GeoCity) => {
    onCitySelect?.(city);
    document.getElementById(VENUE_SEARCH_INPUT_ID)?.focus();
  };

  const searchAgain = () => {
    flushSync(() => {
      setIsBrowsingNearby(true);
      overlay?.onSearch?.();
    });
    document.getElementById(VENUE_SEARCH_INPUT_ID)?.focus();
  };

  const results = (
    <>
      {onCitySelect && isSearching && (
        <CitySuggestions
          locale={locale}
          marketCode={marketCode}
          query={query}
          currentCityCode={cityCode}
          onSelect={chooseCity}
        />
      )}
      {rows.length > 0 && (
        <div>
          {!overlay && (
            <p className="mb-1.5 text-caption text-neutral">{listLabel}</p>
          )}
          <div
            className={
              boundedList
                ? 'max-h-72 overflow-y-auto pe-1'
                : overlay
                  ? undefined
                  : 'max-lg:max-h-40 max-lg:overflow-y-auto max-lg:pe-1'
            }
          >
            <HostVenueList
              locale={locale}
              id={VENUE_LIST_ID}
              label={listLabel}
              venues={rows}
              selectedProviderId={venue?.providerId}
              showAttribution={!isSearching && !isPinned}
              onSelect={onVenueSelect}
              onChoose={overlay?.onDismiss}
            />
          </div>
        </div>
      )}
      <StatusMessage
        variant="info"
        iconClassName={
          isHintBesideLocate ? 'max-lg:size-4 max-lg:self-center' : undefined
        }
        className={
          isHintBesideLocate
            ? 'max-lg:content-center max-lg:items-center max-lg:gap-2 max-lg:px-3 max-lg:py-0 max-lg:text-caption max-lg:shadow-lg'
            : undefined
        }
      >
        {rows.length > 0 ? null : emptyMessage}
      </StatusMessage>
      {isPinned && (
        <button
          type="button"
          className="btn btn-ghost btn-xs sm:btn-sm md:btn-md self-start"
          onClick={() => setIsBrowsingNearby(true)}
        >
          {host_venue_browse_nearby({}, { locale })}
        </button>
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div ref={pickerRef} className="contents">
        {isExploring ? (
          <HostVenueChoice
            locale={locale}
            venue={venue}
            venueName={venueName}
          />
        ) : (
          <VenueSearch
            locale={locale}
            area={area}
            value={searchValue}
            listId={VENUE_LIST_ID}
            hasResults={rows.length > 0 && !overlay?.isCollapsed}
            isDisabled={isDisabled}
            isLoading={isSearching && search.isFetching}
            onChange={onSearchChange}
          />
        )}
        <VenueStepToasts locale={locale} notices={notices} />
        {overlay ? (
          <VenueResultsPanel
            label={isExploring || isHintOnly ? null : listLabel}
            {...overlay}
          >
            {isExploring ? (
              <HostMapButton
                icon={Search}
                label={host_search_venues({}, { locale })}
                onClick={searchAgain}
              />
            ) : (
              results
            )}
          </VenueResultsPanel>
        ) : (
          results
        )}
      </div>
      {venue?.kind === 'address' && !hideNameField && (
        <HostVenueNameField
          locale={locale}
          value={venueName}
          error={nameError}
          onChange={onVenueNameChange}
        />
      )}
    </div>
  );
};
