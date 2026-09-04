import { Link } from '@tanstack/react-router';

import {
  chairs_left,
  formatDate,
  full_waitlist,
  going_count,
  rsvp_already,
  rsvp_no_limit,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

type EventCardProps = {
  event: EventFeedItem;
  locale: Locale;
  timezone: string;
  marketSlug: string;
};

export const EventCard = ({
  event,
  locale,
  timezone,
  marketSlug,
}: EventCardProps) => {
  const start = new Date(event.startsAt);
  const at = (options: Intl.DateTimeFormatOptions) =>
    formatDate(start, locale, {
      timeZone: timezone,
      hour12: false,
      ...options,
    });
  const cityName = locale === 'ar' ? event.cityNameAr : event.cityName;
  const remaining = event.remaining;
  const isGoing = event.viewerRsvp === 'going';

  return (
    <Link
      to="/$market/e/$slug"
      params={{ market: marketSlug, slug: event.slug }}
      className="flex h-full gap-3.5 rounded-box border border-base-300 bg-base-100 p-3.5 transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none"
    >
      <span className="flex w-14 shrink-0 flex-col items-center justify-center gap-px self-start rounded-field bg-base-200 py-2">
        <span className="eyebrow">{at({ weekday: 'short' })}</span>
        <span className="font-display text-h4 font-semibold leading-none">
          {at({ day: 'numeric' })}
        </span>
        <span className="eyebrow hidden sm:block">
          {at({ month: 'short' })}
        </span>
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-display text-body font-semibold leading-snug">
          {event.title}
        </span>
        <span className="text-body-sm text-neutral">
          {at({ hour: '2-digit', minute: '2-digit' })} · {event.venue}
          <span className="hidden sm:inline">
            {locale === 'ar' ? '،' : ','} {cityName}
          </span>
        </span>

        <span className="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
          {event.goingCount != null ? (
            <span className="text-caption text-neutral">
              {going_count({ count: event.goingCount }, { locale })}
            </span>
          ) : null}

          {isGoing ? (
            <span className="ms-auto inline-flex h-[1.375rem] items-center gap-1.5 rounded-full bg-success-tint px-2.5 text-caption font-medium text-success">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success"
              />
              {rsvp_already({}, { locale })}
            </span>
          ) : remaining != null && remaining > 0 ? (
            <span className="ms-auto inline-flex h-[1.375rem] items-center gap-1.5 rounded-full bg-secondary-tint px-2.5 text-caption font-medium text-accent">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-secondary"
              />
              {chairs_left({ n: remaining }, { locale })}
            </span>
          ) : remaining != null ? (
            <span className="ms-auto inline-flex h-[1.375rem] items-center rounded-full bg-base-200 px-2.5 text-caption font-medium text-neutral">
              {full_waitlist({}, { locale })}
            </span>
          ) : (
            <span className="ms-auto inline-flex h-[1.375rem] items-center rounded-full bg-base-200 px-2.5 text-caption font-medium text-neutral">
              {rsvp_no_limit({}, { locale })}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
};
