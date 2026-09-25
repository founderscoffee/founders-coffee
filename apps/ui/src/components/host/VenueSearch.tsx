import { RefreshCw } from 'lucide-react';

import {
  cityInputs,
  retry,
  host_venue_search_label,
  host_venue_search_loading,
  host_venue_search_ph,
  host_venue_search_ph_market,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

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
      <LoadingStatus
        label={host_venue_search_loading({}, { locale })}
        className="mt-2 text-caption"
      />
    )}
    {errorMessage && (
      <StatusMessage
        variant="error"
        className="mt-2"
        action={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onRetry}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {retry({}, { locale })}
          </button>
        }
      >
        {errorMessage}
      </StatusMessage>
    )}
  </div>
);
