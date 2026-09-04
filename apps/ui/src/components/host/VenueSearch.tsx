import { MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import {
  host_retry,
  host_venue_no_results,
  host_venue_rate_limited,
  host_venue_search_error,
  host_venue_search_label,
  host_venue_search_loading,
  host_venue_search_ph,
  type Locale,
} from '@founders-coffee/i18n';

import { useVenueSearch } from '../../features/events/hooks';
import { VENUE_SEARCH_MAX_LENGTH } from '../../features/events/types';
import type { VenueSelection } from '../../features/events/types';

type VenueSearchProps = {
  locale: Locale;
  cityName: string;
  cityCode: string;
  marketCode: string;
  value: string;
  isDisabled?: boolean;
  onChange: (value: string) => void;
  onVenueSelect: (venue: VenueSelection) => void;
};

const SEARCH_DELAY_MS = 350;

export const VenueSearch = ({
  locale,
  cityName,
  cityCode,
  marketCode,
  value,
  isDisabled = false,
  onChange,
  onVenueSelect,
}: VenueSearchProps) => {
  const [query, setQuery] = useState(value.trim());
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(value.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [value]);

  const search = useVenueSearch({
    marketCode,
    cityCode,
    locale,
    query: isOpen && !isDisabled ? query : '',
  });
  const hasQuery = query.length >= 2;
  const isResultsVisible = hasQuery && isOpen && !isDisabled;
  const results = hasQuery ? (search.data ?? []) : [];
  const errorCode = appErrorCode(search.error);
  const errorMessage =
    errorCode === 'map_venue_outside_city' ||
    errorCode === 'map_venue_unsupported'
      ? host_venue_no_results({}, { locale })
      : errorCode === 'rate_limited'
        ? host_venue_rate_limited({}, { locale })
        : host_venue_search_error({}, { locale });

  const resultsKey = `${query}:${results.length}`;
  const [highlightedFor, setHighlightedFor] = useState(resultsKey);
  if (highlightedFor !== resultsKey) {
    setHighlightedFor(resultsKey);
    setActiveIndex(-1);
  }

  const chooseVenue = (venue: VenueSelection) => {
    setIsOpen(false);
    setActiveIndex(-1);
    onVenueSelect(venue);
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <label htmlFor="venue-search" className="sr-only">
        {host_venue_search_label({}, { locale })}
      </label>
      <input
        id="venue-search"
        maxLength={VENUE_SEARCH_MAX_LENGTH}
        type="search"
        className="input input-bordered h-14 w-full rounded-xl bg-base-100 text-base"
        placeholder={host_venue_search_ph({ city: cityName }, { locale })}
        value={value}
        disabled={isDisabled}
        autoComplete="off"
        role="combobox"
        aria-controls="venue-search-results"
        aria-expanded={isResultsVisible}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `venue-search-option-${activeIndex}` : undefined
        }
        onFocus={() => {
          if (!isDisabled) setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false);
            setActiveIndex(-1);
          }
          if (event.key === 'ArrowDown' && results.length > 0) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) => (current + 1) % results.length);
          }
          if (event.key === 'ArrowUp' && results.length > 0) {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) =>
              current <= 0 ? results.length - 1 : current - 1,
            );
          }
          if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            const selected = results[activeIndex];
            if (selected) chooseVenue(selected);
          }
        }}
        onChange={(event) => {
          setIsOpen(true);
          onChange(event.target.value);
        }}
      />

      {isResultsVisible && (
        <div
          id="venue-search-results"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-xl"
        >
          {search.isFetching ? (
            <p className="flex items-center gap-2 p-4 text-sm" role="status">
              <span className="loading loading-spinner loading-sm" />
              {host_venue_search_loading({}, { locale })}
            </p>
          ) : search.isError ? (
            <div
              className="flex items-center justify-between gap-3 p-4"
              role="alert"
            >
              <span className="text-sm text-error">{errorMessage}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void search.refetch()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {host_retry({}, { locale })}
              </button>
            </div>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-base-content/60" role="status">
              {host_venue_no_results({}, { locale })}
            </p>
          ) : (
            <ul
              role="listbox"
              aria-label={host_venue_search_label({}, { locale })}
            >
              {results.map((venue, index) => (
                <li key={venue.providerId} role="presentation">
                  <button
                    id={`venue-search-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className="flex w-full items-start gap-3 border-b border-base-200 p-3 text-start transition last:border-b-0 hover:bg-base-200 focus-visible:bg-base-200"
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => chooseVenue(venue)}
                  >
                    <MapPin
                      className="mt-0.5 size-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {venue.name}
                      </span>
                      <span className="block truncate text-xs text-base-content/60">
                        {venue.address}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
