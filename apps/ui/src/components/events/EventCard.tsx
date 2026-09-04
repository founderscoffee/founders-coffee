import { Link } from '@tanstack/react-router';

import {
  chairs_left,
  formatDate,
  full_waitlist,
  going_count,
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
  const weekday = formatDate(start, locale, {
    timeZone: timezone,
    weekday: 'short',
  });
  const day = formatDate(start, locale, { timeZone: timezone, day: 'numeric' });
  const month = formatDate(start, locale, {
    timeZone: timezone,
    month: 'short',
  });
  const time = formatDate(start, locale, {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  });
  const cityName = locale === 'ar' ? event.cityNameAr : event.cityName;
  const remaining = event.remaining;

  return (
    <Link
      to="/$market/e/$slug"
      params={{ market: marketSlug, slug: event.slug }}
      className="block max-w-[45rem] rounded-box"
    >
      <article className="flex gap-4 rounded-box border border-base-300 bg-base-100 p-4 transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none">
        <div className="flex w-[3.75rem] shrink-0 flex-col items-center justify-center gap-px rounded-field bg-base-200 py-2.5">
          <span className="eyebrow">{weekday}</span>
          <span className="font-display text-h3 font-semibold leading-none">
            {day}
          </span>
          <span className="eyebrow">{month}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="font-display text-body font-semibold leading-snug">
            {event.title}
          </h3>
          <p className="text-body-sm text-neutral">
            {time} · {event.venue}
            {locale === 'ar' ? '،' : ','} {cityName}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {event.goingCount != null ? (
              <span className="text-caption font-medium text-neutral">
                {going_count({ count: event.goingCount }, { locale })}
              </span>
            ) : null}
            {remaining != null && remaining > 0 ? (
              <span className="ms-auto inline-flex h-[1.375rem] items-center gap-1.5 rounded-full bg-secondary-tint px-2.5 text-caption font-medium text-accent">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-secondary"
                />
                {chairs_left({ n: remaining }, { locale })}
              </span>
            ) : null}
            {remaining != null && remaining <= 0 ? (
              <span className="ms-auto inline-flex h-[1.375rem] items-center rounded-full bg-base-200 px-2.5 text-caption font-medium text-neutral">
                {full_waitlist({}, { locale })}
              </span>
            ) : null}
          </div>
        </div>
      </article>
    </Link>
  );
};
