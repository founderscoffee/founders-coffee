import { RefreshCw } from 'lucide-react';

import {
  cityInputs,
  host_retry,
  host_venue_search_label,
  host_venue_search_loading,
  host_venue_search_ph,
  host_venue_search_ph_market,
  type Locale,
} from '@founders-coffee/i18n';

import {
  VENUE_SEARCH_MAX_LENGTH,
  type VenueArea,
} from '../../features/events/types';

type VenueSearchProps = {
  locale: Locale;
  area: VenueArea;
  value: string;
  listId: string;
  hasResults: boolean;
  isDisabled?: boolean;
  isLoading: boolean;
  errorMessage?: string;
  onChange: (value: string) => void;
  onRetry: () => void;
};

export const VenueSearch = ({
  locale,
  area,
  value,
  listId,
  hasResults,
  isDisabled = false,
  isLoading,
  errorMessage,
  onChange,
  onRetry,
}: VenueSearchProps) => (
  <div>
    <label className="sr-only" htmlFor="venue-search">
      {host_venue_search_label({}, { locale })}
    </label>
    <input
      id="venue-search"
      maxLength={VENUE_SEARCH_MAX_LENGTH}
      type="search"
      role="combobox"
      aria-expanded={hasResults}
      aria-controls={listId}
      aria-autocomplete="list"
      className="input input-bordered h-12 w-full rounded-xl bg-base-100 text-body md:h-13"
      placeholder={
        area.kind === 'city'
          ? host_venue_search_ph(cityInputs(area.name), { locale })
          : host_venue_search_ph_market({ market: area.name }, { locale })
      }
      value={value}
      disabled={isDisabled}
      autoComplete="off"
      onChange={(event) => onChange(event.target.value)}
    />
    {isLoading && (
      <p
        className="mt-2 flex items-center gap-2 text-caption text-neutral"
        role="status"
      >
        <span
          className="loading loading-spinner loading-xs"
          aria-hidden="true"
        />
        {host_venue_search_loading({}, { locale })}
      </p>
    )}
    {errorMessage && (
      <p
        className="mt-2 flex items-center gap-2 text-body-sm text-error"
        role="alert"
      >
        {errorMessage}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onRetry}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {host_retry({}, { locale })}
        </button>
      </p>
    )}
  </div>
);
