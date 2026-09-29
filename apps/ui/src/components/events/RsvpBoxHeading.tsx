import { Check } from 'lucide-react';

import {
  rsvp_already,
  rsvp_box_cancelled,
  rsvp_box_closed,
  rsvp_box_ended,
  rsvp_box_host,
  rsvp_box_title,
  type Locale,
} from '@founders-coffee/i18n';

import type { EventPhase } from '../../features/events/live-window';

type RsvpBoxHeadingProps = {
  locale: Locale;
  isHost: boolean;
  isCancelled: boolean;
  isGoing: boolean;
  phase: EventPhase;
};

const BASE_CLASS = 'mb-4 font-display text-h4 font-semibold';

const titleFor = ({
  locale,
  isHost,
  isCancelled,
  phase,
}: RsvpBoxHeadingProps): string => {
  if (isHost) return rsvp_box_host({}, { locale });
  if (isCancelled) return rsvp_box_cancelled({}, { locale });
  if (phase === 'ended') return rsvp_box_ended({}, { locale });
  if (phase === 'started') return rsvp_box_closed({}, { locale });
  return rsvp_box_title({}, { locale });
};

export const RsvpBoxHeading = (props: RsvpBoxHeadingProps) => {
  const { locale, isHost, isCancelled, isGoing, phase } = props;
  const isConfirmed = !isHost && !isCancelled && isGoing && phase !== 'ended';

  if (isConfirmed)
    return (
      <h2
        id="event-rsvp-title"
        className={`${BASE_CLASS} inline-flex items-center gap-2 text-success`}
      >
        <Check className="size-5" aria-hidden="true" />
        {rsvp_already({}, { locale })}
      </h2>
    );

  return (
    <h2 id="event-rsvp-title" className={BASE_CLASS}>
      {titleFor(props)}
    </h2>
  );
};
