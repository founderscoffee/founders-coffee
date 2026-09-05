import {
  host_pin_hint,
  host_selected_location,
  type Locale,
} from '@founders-coffee/i18n';

import type { Ref } from 'react';

import type { VenueSelection } from '../../features/events/types';
import { CALLOUT_GAP, PIN_HEIGHT } from './callout-placement';

const ABOVE_TRANSFORM = `translateY(calc(-100% - ${PIN_HEIGHT + CALLOUT_GAP * 2}px))`;

type HostVenueCalloutProps = {
  venue: VenueSelection;
  locale: Locale;
  above: boolean;
  ref?: Ref<HTMLDivElement>;
};

export const HostVenueCallout = ({
  venue,
  locale,
  above,
  ref,
}: HostVenueCalloutProps): React.ReactElement => (
  <div
    ref={ref}
    style={above ? { transform: ABOVE_TRANSFORM } : undefined}
    className="w-64 max-w-[70vw] rounded-2xl bg-base-100 p-4 shadow-[0_10px_30px_rgba(39,15,0,0.18)]"
  >
    <p className="eyebrow">{host_selected_location({}, { locale })}</p>
    <p className="mt-1 line-clamp-1 font-semibold text-base-content" dir="auto">
      {venue.name}
    </p>
    <p
      className="mt-0.5 line-clamp-2 text-body-sm text-base-content"
      dir="auto"
    >
      {venue.address}
    </p>
    <p className="mt-1.5 text-body-sm text-taupe">
      {host_pin_hint({}, { locale })}
    </p>
  </div>
);
