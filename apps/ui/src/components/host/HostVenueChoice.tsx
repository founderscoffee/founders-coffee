import { MapPin } from 'lucide-react';

import {
  host_selected_location,
  host_venue_empty,
  host_venue_resolving,
  type Locale,
} from '@founders-coffee/i18n';

import { useIsLocatingVenue } from '../../features/events/hooks';
import type { VenueSelection } from '../../features/events/types';

type HostVenueChoiceProps = {
  locale: Locale;
  venue: VenueSelection | null;
  venueName: string;
};

const LINE =
  'flex h-8 min-w-0 items-center gap-2 rounded-xl border border-base-300 bg-base-200 px-3 text-body-sm md:h-10';

export const HostVenueChoice = ({
  locale,
  venue,
  venueName,
}: HostVenueChoiceProps) => {
  const isLocating = useIsLocatingVenue();

  if (venue) {
    return (
      <div
        role="group"
        aria-label={host_selected_location({}, { locale })}
        className={LINE}
      >
        <MapPin className="size-4 shrink-0 text-secondary" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 items-baseline gap-2">
          <bdi className="min-w-0 truncate font-semibold">
            {venueName || venue.address}
          </bdi>
          {venueName && (
            <bdi className="min-w-0 flex-1 truncate text-caption text-neutral">
              {venue.address}
            </bdi>
          )}
        </span>
      </div>
    );
  }

  return (
    <p className={`${LINE} text-neutral`}>
      {isLocating ? (
        <span
          className="loading loading-spinner loading-xs shrink-0"
          aria-hidden="true"
        />
      ) : (
        <MapPin className="size-4 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">
        {isLocating
          ? host_venue_resolving({}, { locale })
          : host_venue_empty({}, { locale })}
      </span>
    </p>
  );
};
