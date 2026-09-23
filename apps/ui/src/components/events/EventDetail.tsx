import { Link } from '@tanstack/react-router';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import {
  back_to_city,
  cityInputs,
  event_cancelled_body,
  event_cancelled_title,
  event_details_title,
  event_host,
  event_timezone,
  event_when,
  event_where,
  formatDate,
  localizedName,
  going_count,
  host_time_from,
  host_time_to,
  ntf_cancel_reason,
  profile_link,
  role_host,
  share_event_action,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type {
  EventDetailItem,
  PublicProfile,
} from '@founders-coffee/server-fns';

import { eventCityName } from '../../features/events/event-city-name';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import {
  localizedCity,
  localizedPublicProfile,
} from '../../lib/locale-routing';
import { EventLocationMap } from './EventLocationMap';
import { RsvpBoxHeading } from './RsvpBoxHeading';
import { RsvpSection } from './RsvpSection';
import { ShareEventButton } from './ShareEventButton';

type EventDetailProps = {
  locale: Locale;
  market: Market;
  event: EventDetailItem;
  host: PublicProfile | null;
  isHost: boolean;
  live: UseEventLiveResult | null;
  isWindowOpen: boolean;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || '?';

export const EventDetail = ({
  locale,
  market,
  event,
  host,
  isHost,
  live,
  isWindowOpen,
}: EventDetailProps) => {
  const hostName = host?.displayName ?? role_host({}, { locale });
  const on = (value: Date, options: Intl.DateTimeFormatOptions) =>
    formatDate(value, locale, {
      timeZone: market.timezone,
      hour12: false,
      ...options,
    });
  const clock = { hour: '2-digit', minute: '2-digit' } as const;
  const start = new Date(event.startsAt);
  const end = event.endsAt == null ? null : new Date(event.endsAt);
  const day = on(start, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const times =
    end == null
      ? on(start, clock)
      : `${on(start, clock)}\u2013${on(end, clock)}`;
  const timeRange =
    end == null ? (
      <bdi dir="ltr">{times}</bdi>
    ) : locale === 'ar' ? (
      <span dir="rtl">
        {host_time_from({}, { locale })} <bdi dir="ltr">{on(start, clock)}</bdi>{' '}
        {host_time_to({}, { locale })} <bdi dir="ltr">{on(end, clock)}</bdi>
      </span>
    ) : (
      <bdi dir="ltr">{times}</bdi>
    );

  const cityName = eventCityName(event, locale);
  const contentDirection = locale === 'ar' ? 'rtl' : 'ltr';
  const isCancelled = event.status === 'cancelled';
  const hasRsvpBox = isHost || !isCancelled || event.viewerRsvp === 'going';

  return (
    <article className="mx-auto max-w-5xl px-4 py-6 sm:py-8 md:px-8 md:py-10">
      {event.citySlug && (
        <Link
          {...localizedCity(locale, market.slug, event.citySlug)}
          className="mb-4 inline-flex min-h-6 items-center text-body-sm font-medium underline decoration-secondary underline-offset-[3px] hover:text-accent"
        >
          {back_to_city(cityInputs(cityName), { locale })}
        </Link>
      )}

      {isCancelled && (
        <div
          role="status"
          className="mb-4 rounded-box border border-error bg-error-tint p-4"
        >
          <p className="font-display text-h4 font-semibold text-error">
            {event_cancelled_title({}, { locale })}
          </p>
          <p className="mt-1 text-body-sm text-neutral">
            {event_cancelled_body({}, { locale })}
          </p>
          {event.cancellationReason ? (
            <p className="mt-2 text-body-sm text-base-content">
              {ntf_cancel_reason(
                { reason: event.cancellationReason },
                { locale },
              )}
            </p>
          ) : null}
        </div>
      )}

      <header className="rounded-box bg-base-200 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral">
            <MapPin className="size-4 text-secondary" aria-hidden="true" />
            <span dir="auto">{cityName}</span>
          </span>
        </div>
        <h1 className="mt-4 max-w-3xl font-display text-h1 font-semibold text-balance">
          {event.title}
        </h1>
        {event.description ? (
          <p className="mt-4 max-w-3xl whitespace-pre-line text-body-lg leading-relaxed text-neutral">
            {event.description}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full bg-base-100 px-3 py-2 text-body-sm font-medium">
            <CalendarDays
              className="size-4 text-secondary"
              aria-hidden="true"
            />
            <time dateTime={start.toISOString()} dir={contentDirection}>
              {day} · {timeRange}
            </time>
          </span>
          {event.goingCount > 0 && !isCancelled ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary-tint px-3 py-2 text-body-sm font-medium text-accent">
              <Users className="size-4" aria-hidden="true" />
              {going_count({ count: event.goingCount }, { locale })}
            </span>
          ) : null}
          {isCancelled ? null : (
            <ShareEventButton
              locale={locale}
              eventId={event.id}
              title={event.title}
              label={share_event_action({}, { locale })}
            />
          )}
        </div>
      </header>

      {event.latitude != null && event.longitude != null ? (
        <div className="mt-4 w-full">
          <EventLocationMap
            locale={locale}
            venue={event.venue}
            latitude={event.latitude}
            longitude={event.longitude}
          />
        </div>
      ) : null}

      <div
        className={`mt-8 grid gap-8 ${hasRsvpBox ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]' : ''}`}
      >
        <section aria-labelledby="event-details-title">
          <h2
            id="event-details-title"
            className="font-display text-h4 font-semibold"
          >
            {event_details_title({}, { locale })}
          </h2>

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_when({}, { locale })}</dt>
              <dd className="mt-1.5 font-medium">
                <time dateTime={start.toISOString()} dir={contentDirection}>
                  {day} · {timeRange}
                </time>
              </dd>
              <dd className="mt-0.5 text-body-sm text-neutral">
                {event_timezone(
                  { market: localizedName(market, locale) },
                  { locale },
                )}
              </dd>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_where({}, { locale })}</dt>
              <dd className="mt-1.5 flex items-start gap-2 font-medium">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <span dir="auto">{event.venue}</span>
              </dd>
              {event.venueAddress ? (
                <dd
                  className="mt-0.5 ps-6 text-body-sm text-neutral"
                  dir="auto"
                >
                  {event.venueAddress}
                </dd>
              ) : null}
            </div>
          </dl>

          <section className="mt-6 rounded-box border border-base-300 bg-base-100 p-4">
            <h3 className="eyebrow">{event_host({}, { locale })}</h3>
            <div className="mt-3 flex items-center gap-3.5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold">
                {initials(hostName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold">
                  {hostName}
                </span>
                <span className="block text-body-sm text-neutral" dir="auto">
                  {role_host({}, { locale })} · {cityName}
                </span>
              </span>
              {host ? (
                <Link
                  {...localizedPublicProfile(locale, host.userId)}
                  className="btn btn-outline btn-sm h-9 min-h-9 px-4"
                >
                  {profile_link({}, { locale })}
                </Link>
              ) : null}
            </div>
          </section>
        </section>

        {hasRsvpBox ? (
          <aside className="flex h-full flex-col gap-4 lg:sticky lg:top-6 lg:self-stretch lg:pt-12">
            <section
              aria-labelledby="event-rsvp-title"
              className="flex flex-1 flex-col rounded-box border-2 border-secondary bg-base-100 p-5 shadow-[var(--shadow-2)]"
            >
              <RsvpBoxHeading
                locale={locale}
                isHost={isHost}
                isCancelled={isCancelled}
                isGoing={event.viewerRsvp === 'going'}
              />
              <div className="mt-auto">
                <RsvpSection
                  event={event}
                  hostName={hostName}
                  marketSlug={market.slug}
                  locale={locale}
                  isHost={isHost}
                  live={live}
                  isWindowOpen={isWindowOpen}
                />
              </div>
            </section>
          </aside>
        ) : null}
      </div>
    </article>
  );
};
