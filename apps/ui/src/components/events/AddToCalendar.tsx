import { CalendarPlus, ChevronDown } from 'lucide-react';
import { useId } from 'react';

import { eventCalendarPath } from '@founders-coffee/core';
import {
  calendar_add,
  calendar_apple,
  calendar_google,
  calendar_outlook,
  type Locale,
} from '@founders-coffee/i18n';

import { AppleMark, GoogleCalendarMark, OutlookMark } from '../BrandMarks';
import { useDismissableDetails } from '../shell/useDismissableDetails';

type AddToCalendarProps = {
  eventId: string;
  startsAt: Date;
  locale: Locale;
  label?: string;
  isFullWidth?: boolean;
};

export const AddToCalendar = ({
  eventId,
  startsAt,
  locale,
  label,
  isFullWidth = false,
}: AddToCalendarProps) => {
  const headingId = useId();
  const { ref, close } = useDismissableDetails();

  if (startsAt.getTime() <= Date.now()) return null;

  const calendarFile = eventCalendarPath(locale, eventId, 'ics');
  const width = isFullWidth ? ' w-full' : '';

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="flex flex-col gap-2"
    >
      <p id={headingId} className="sr-only">
        {calendar_add({}, { locale })}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <details ref={ref} className={`dropdown dropdown-start${width}`}>
          <summary
            aria-describedby={headingId}
            className={`btn btn-outline btn-xs sm:btn-sm md:btn-md flex list-none gap-2${width}`}
          >
            <CalendarPlus
              className="size-4 shrink-0 sm:size-5"
              aria-hidden="true"
            />
            {label ?? calendar_add({}, { locale })}
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </summary>
          <ul
            className="menu dropdown-content z-10 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow-[var(--shadow-2)]"
            onClick={close}
          >
            <li>
              <a
                href={eventCalendarPath(locale, eventId, 'google')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GoogleCalendarMark />
                {calendar_google({}, { locale })}
              </a>
            </li>
            <li>
              <a href={calendarFile}>
                <AppleMark />
                {calendar_apple({}, { locale })}
              </a>
            </li>
            <li>
              <a href={calendarFile}>
                <OutlookMark />
                {calendar_outlook({}, { locale })}
              </a>
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
};
