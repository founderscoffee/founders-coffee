import { MapPin } from 'lucide-react';

import { host_selected_location, type Locale } from '@founders-coffee/i18n';

import type { VenueSelection } from '../../features/events/types';

type HostVenueChoiceProps = {
  locale: Locale;
  venue: VenueSelection;
  venueName: string;
};

export const HostVenueChoice = ({
  locale,
  venue,
  venueName,
}: HostVenueChoiceProps) => (
  <div
    role="group"
    aria-label={host_selected_location({}, { locale })}
    className="flex min-w-0 items-start gap-2"
  >
    <MapPin
      className="mt-0.5 size-4 shrink-0 text-secondary"
      aria-hidden="true"
    />
    <span className="flex min-w-0 flex-1 flex-col">
      <bdi className="truncate text-body-sm font-semibold">
        {venueName || venue.address}
      </bdi>
      {venueName && (
        <bdi className="truncate text-caption text-neutral">
          {venue.address}
        </bdi>
      )}
    </span>
  </div>
);
