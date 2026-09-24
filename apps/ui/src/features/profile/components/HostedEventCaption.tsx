import { Check } from 'lucide-react';

import {
  event_past,
  event_took_place,
  type Locale,
} from '@founders-coffee/i18n';

export const HostedEventCaption = ({
  isOnRecord,
  isPast,
  locale,
}: {
  isOnRecord: boolean;
  isPast: boolean;
  locale: Locale;
}) => {
  if (isOnRecord)
    return (
      <p className="mb-1">
        <span className="badge badge-sm badge-success badge-soft gap-1">
          <Check className="size-3" aria-hidden="true" />
          {event_took_place({}, { locale })}
        </span>
      </p>
    );
  if (!isPast) return null;
  return (
    <p className="mb-1 text-caption text-neutral">
      {event_past({}, { locale })}
    </p>
  );
};
