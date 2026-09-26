import { CalendarPlus, Download } from 'lucide-react';
import { useId } from 'react';

import { eventCalendarPath } from '@founders-coffee/core';
import {
  calendar_add,
  calendar_google,
  calendar_other,
  type Locale,
} from '@founders-coffee/i18n';

type AddToCalendarProps = {
  eventId: string;
  startsAt: Date;
  locale: Locale;
};

export const AddToCalendar = ({
  eventId,
  startsAt,
  locale,
}: AddToCalendarProps) => {
  const headingId = useId();

  if (startsAt.getTime() <= Date.now()) return null;

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
    >
      <p id={headingId} className="text-body-sm font-medium text-base-content">
        {calendar_add({}, { locale })}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          className="btn btn-outline btn-sm"
          href={eventCalendarPath(locale, eventId, 'google')}
          target="_blank"
          rel="noreferrer"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          {calendar_google({}, { locale })}
        </a>
        <a
          className="btn btn-outline btn-sm"
          href={eventCalendarPath(locale, eventId, 'ics')}
        >
          <Download className="size-4" aria-hidden="true" />
          {calendar_other({}, { locale })}
        </a>
      </div>
    </div>
  );
};
