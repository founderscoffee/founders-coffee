import {
  cityInputs,
  host_venue_search_label,
  host_venue_search_loading,
  host_venue_search_ph,
  host_venue_search_ph_market,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

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
  onChange: (value: string) => void;
};

export const VenueSearch = ({
  locale,
  area,
  value,
  listId,
  hasResults,
  isDisabled = false,
  isLoading,
  onChange,
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
      className="input input-bordered h-11 w-full rounded-xl bg-base-100 text-body lg:h-12"
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
        className="mt-1.5 text-caption"
      />
    )}
  </div>
);
