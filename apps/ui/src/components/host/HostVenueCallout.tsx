import {
  host_pin_hint,
  host_selected_location,
  type Locale,
} from '@founders-coffee/i18n';

import type { Ref } from 'react';

import type { VenueSelection } from '../../features/events/types';
import { venueAddressLine } from '../../features/events/venue-address-line';

type HostVenueCalloutProps = {
  venue: VenueSelection;
  locale: Locale;
  showHint: boolean;
  ref?: Ref<HTMLDivElement>;
};

export const HostVenueCallout = ({
  venue,
  locale,
  showHint,
  ref,
}: HostVenueCalloutProps): React.ReactElement => {
  const address = venueAddressLine(venue);
  return (
    <div
      ref={ref}
      className="w-64 max-w-[70vw] rounded-2xl bg-base-100 p-4 shadow-[0_10px_30px_rgba(39,15,0,0.18)]"
    >
      <p className="eyebrow">{host_selected_location({}, { locale })}</p>
      <p
        className={`mt-1 font-semibold text-base-content ${
          address ? 'line-clamp-1' : 'line-clamp-2'
        }`}
        dir="auto"
      >
        {venue.name}
      </p>
      {address && (
        <p
          className="mt-0.5 line-clamp-2 text-body-sm text-base-content"
          dir="auto"
        >
          {address}
        </p>
      )}
      {showHint && (
        <p className="mt-1.5 text-body-sm text-neutral">
          {host_pin_hint({}, { locale })}
        </p>
      )}
    </div>
  );
};
