import { Link } from '@tanstack/react-router';
import { ArrowUpRight, MapPin } from 'lucide-react';

import {
  event_details_title,
  event_host,
  formatDate,
  going_count,
  rsvp_attending,
  type Locale,
} from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

import { localizedEvent } from '../../lib/locale-routing';

type EventCardProps = {
  event: EventFeedItem;
  locale: Locale;
  timezone: string;
  marketSlug: string;
  trailing?: 'city' | 'language';
};

const hostPhotoUrl = (assetId: string): string =>
  `/media/profile/${assetId}/sm`;

export const EventCard = ({
  event,
  locale,
  timezone,
  marketSlug,
  trailing = 'city',
}: EventCardProps) => {
  const start = new Date(event.startsAt);
  const end = event.endsAt == null ? null : new Date(event.endsAt);
  const on = (date: Date, options: Intl.DateTimeFormatOptions) =>
    formatDate(date, locale, {
      timeZone: timezone,
      hour12: false,
      ...options,
    });
  const at = (options: Intl.DateTimeFormatOptions) => on(start, options);
  const clock = { hour: '2-digit', minute: '2-digit' } as const;
  const timeRange =
    end == null ? at(clock) : `${at(clock)}\u2013${on(end, clock)}`;
  const cityName = locale === 'ar' ? event.cityNameAr : event.cityName;
  const isGoing = event.viewerRsvp === 'going';
  const hasHost = event.hostName != null && event.hostName.length > 0;
  const attendeeCount = event.goingCount ?? 0;
  const additionalAttendeeCount = Math.max(
    0,
    attendeeCount - (hasHost ? 1 : 0),
  );
  const detailsHref = localizedEvent(locale, marketSlug, event.slug);

  return (
    <article className="flex h-full flex-col items-stretch gap-3.5 rounded-box border border-base-300 bg-base-100 p-3.5 transition-shadow duration-200 ease-out hover:shadow-[var(--shadow-2)] motion-reduce:transition-none sm:flex-row">
      <Link
        {...detailsHref}
        className="flex h-full min-w-0 flex-1 flex-col gap-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary sm:flex-row"
      >
        <time
          dateTime={start.toISOString()}
          className="flex h-auto w-full shrink-0 flex-col items-center justify-center gap-px self-stretch rounded-field bg-base-200 py-3 sm:h-full sm:w-[6.5rem]"
        >
          <span className="datechip-line">{at({ weekday: 'short' })}</span>
          <span className="font-display text-h4 font-semibold leading-none">
            {at({ day: 'numeric' })}
          </span>
          <span className="datechip-line text-neutral">
            {at({ month: 'short' })}
          </span>
        </time>

        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <header>
            <h3
              dir="auto"
              className="font-display text-body font-semibold leading-snug"
            >
              {event.title}
            </h3>
          </header>
          {event.description?.trim() ? (
            <p dir="auto" className="line-clamp-2 text-body-sm text-neutral">
              {event.description}
            </p>
          ) : null}
          <p className="flex flex-wrap items-start gap-x-2 gap-y-1 text-body-sm text-neutral">
            <span dir="ltr" className="whitespace-nowrap tabular-nums">
              {timeRange}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-start gap-1 rounded-full bg-secondary/10 px-2 py-0.5 font-medium text-secondary">
              <MapPin
                className="mt-0.5 size-4 shrink-0 text-secondary"
                aria-hidden="true"
              />
              <span dir="auto">{event.venue}</span>
            </span>
            {trailing === 'language' ? (
              <span className="hidden sm:inline">
                · {event.language.toUpperCase()}
              </span>
            ) : (
              <span dir="auto" className="text-secondary">
                {locale === 'ar' ? '،' : ','} {cityName}
              </span>
            )}
          </p>

          <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1.5">
            {hasHost ? (
              <span
                dir="rtl"
                className="inline-flex min-w-0 items-center gap-2 text-body-sm text-neutral"
              >
                {additionalAttendeeCount > 0 ? (
                  <span
                    className="avatar-group -space-x-3 shrink-0 overflow-visible rtl:space-x-reverse"
                    role="img"
                    aria-label={going_count(
                      { count: attendeeCount },
                      { locale },
                    )}
                  >
                    <span className="avatar avatar-placeholder relative z-10 size-7 shrink-0 ring-2 ring-base-100">
                      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-base-200 text-caption font-semibold text-base-content">
                        {event.hostPhotoAssetId ? (
                          <img
                            src={hostPhotoUrl(event.hostPhotoAssetId)}
                            alt=""
                            width="28"
                            height="28"
                            loading="lazy"
                            decoding="async"
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          event.hostName?.slice(0, 1)
                        )}
                      </span>
                    </span>
                    <span className="avatar avatar-placeholder relative z-0 size-7 shrink-0 ring-2 ring-base-100">
                      <span
                        dir="ltr"
                        className="flex size-full items-center justify-center rounded-full bg-base-200 text-caption font-semibold text-base-content"
                      >
                        +{additionalAttendeeCount}
                      </span>
                    </span>
                  </span>
                ) : (
                  <span className="avatar avatar-placeholder size-7 shrink-0">
                    <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-base-200 text-caption font-semibold text-base-content">
                      {event.hostPhotoAssetId ? (
                        <img
                          src={hostPhotoUrl(event.hostPhotoAssetId)}
                          alt=""
                          width="28"
                          height="28"
                          loading="lazy"
                          decoding="async"
                          className="size-full rounded-full object-cover"
                        />
                      ) : (
                        event.hostName?.slice(0, 1)
                      )}
                    </span>
                  </span>
                )}
                <span className="truncate">
                  <span className="sr-only">
                    {event_host({}, { locale })}:{' '}
                  </span>
                  <bdi>{event.hostName}</bdi>
                </span>
              </span>
            ) : null}

            {event.goingCount != null && !hasHost ? (
              <span className="inline-flex items-center gap-2 text-body-sm text-neutral">
                {going_count({ count: event.goingCount }, { locale })}
              </span>
            ) : null}

            {isGoing ? (
              <span className="ms-auto inline-flex h-[1.375rem] items-center gap-1.5 rounded-full bg-success-tint px-2.5 text-caption font-medium text-success">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-success"
                />
                {rsvp_attending({}, { locale })}
              </span>
            ) : null}
          </footer>
        </span>
      </Link>

      <Link
        {...detailsHref}
        className="btn btn-sm btn-outline h-9 min-h-9 w-full shrink-0 self-center whitespace-nowrap px-3 sm:w-auto"
      >
        <span>{event_details_title({}, { locale })}</span>
        <ArrowUpRight className="size-4 rtl:rotate-180" aria-hidden="true" />
      </Link>
    </article>
  );
};
