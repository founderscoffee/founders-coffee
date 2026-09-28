import { CalendarPlus, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { eventCalendarPath } from '@founders-coffee/core';
import {
  calendar_add,
  calendar_apple,
  calendar_google,
  calendar_outlook,
  type Locale,
} from '@founders-coffee/i18n';

import { AppleMark, GoogleCalendarMark, OutlookMark } from '../BrandMarks';

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
  const selectId = useId();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.open = false;
      }
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, []);

  if (startsAt.getTime() <= Date.now()) return null;

  const chooseCalendar = (target: 'google' | 'apple' | 'outlook') => {
    if (target !== 'google' && target !== 'apple' && target !== 'outlook')
      return;
    if (detailsRef.current) detailsRef.current.open = false;
    const href = eventCalendarPath(
      locale,
      eventId,
      target === 'google' ? 'google' : 'ics',
    );
    if (target === 'google') {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    window.location.assign(href);
  };

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
        <details ref={detailsRef} className="dropdown dropdown-start">
          <summary
            id={selectId}
            aria-describedby={headingId}
            className="btn btn-outline btn-xs sm:btn-sm md:btn-md lg:btn-lg list-none gap-2"
          >
            <CalendarPlus
              className="size-4 shrink-0 sm:size-5"
              aria-hidden="true"
            />
            {calendar_add({}, { locale })}
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </summary>
          <ul className="menu dropdown-content z-10 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-1 shadow-[var(--shadow-2)]">
            <li>
              <button type="button" onClick={() => chooseCalendar('google')}>
                <GoogleCalendarMark />
                {calendar_google({}, { locale })}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => chooseCalendar('apple')}>
                <AppleMark />
                {calendar_apple({}, { locale })}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => chooseCalendar('outlook')}>
                <OutlookMark />
                {calendar_outlook({}, { locale })}
              </button>
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
};
