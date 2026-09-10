import { MapPin } from 'lucide-react';

import { host_selected_location, type Locale } from '@founders-coffee/i18n';

import type { VenueSelection } from '../../features/events/types';

type HostVenueLineProps = {
  locale: Locale;
  venue: VenueSelection;
  venueName: string;
};

export const HostVenueLine = ({
  locale,
  venue,
  venueName,
}: HostVenueLineProps): React.ReactElement => (
  <div
    role="group"
    aria-label={host_selected_location({}, { locale })}
    className="flex items-start gap-2 rounded-box border border-base-300 bg-base-200 p-3 lg:hidden"
  >
    <MapPin
      className="mt-0.5 size-4 shrink-0 text-secondary"
      aria-hidden="true"
    />
    <span className="min-w-0">
      <span className="block truncate text-body-sm font-semibold" dir="auto">
        {venueName || venue.name}
      </span>
      <span className="block truncate text-caption text-neutral" dir="auto">
        {venue.address}
      </span>
    </span>
  </div>
);
