import { Check } from 'lucide-react';

import {
  event_host,
  rsvp_already,
  rsvp_box_cancelled,
  rsvp_box_title,
  type Locale,
} from '@founders-coffee/i18n';

type RsvpBoxHeadingProps = {
  locale: Locale;
  isHost: boolean;
  isCancelled: boolean;
  isGoing: boolean;
};

const BASE_CLASS = 'mb-4 font-display text-h4 font-semibold';

export const RsvpBoxHeading = ({
  locale,
  isHost,
  isCancelled,
  isGoing,
}: RsvpBoxHeadingProps) => {
  const isConfirmed = !isHost && !isCancelled && isGoing;

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
      {isHost
        ? event_host({}, { locale })
        : isCancelled
          ? rsvp_box_cancelled({}, { locale })
          : rsvp_box_title({}, { locale })}
    </h2>
  );
};
