import { RefreshCw } from 'lucide-react';

import {
  host_retry,
  host_venue_search_label,
  host_venue_search_loading,
  host_venue_search_ph,
  type Locale,
} from '@founders-coffee/i18n';

import { VENUE_SEARCH_MAX_LENGTH } from '../../features/events/types';

type VenueSearchProps = {
  locale: Locale;
  cityName: string;
  value: string;
  isDisabled?: boolean;
  isLoading: boolean;
  errorMessage?: string;
  onChange: (value: string) => void;
  onRetry: () => void;
};

export const VenueSearch = ({
  locale,
  cityName,
  value,
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
      className="input input-bordered h-12 w-full rounded-xl bg-base-100 text-body md:h-13"
      placeholder={host_venue_search_ph({ city: cityName }, { locale })}
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
