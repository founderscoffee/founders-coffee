import { Link } from '@tanstack/react-router';
import { CalendarDays, MapPin, Users } from 'lucide-react';

import {
  back_to_city,
  cityInputs,
  event_cancelled_body,
  event_cancelled_title,
  event_details_title,
  event_timezone,
  event_when,
  event_where,
  formatDate,
  localizedName,
  going_count,
  host_time_from,
  host_time_to,
  ntf_cancel_reason,
  role_host,
  share_event_action,
  type Locale,
} from '@founders-coffee/i18n';
import {
  IsolatedLines,
  IsolatedValue,
  StatusMessage,
} from '@founders-coffee/ui';
import type { Market } from '@founders-coffee/db';
import type {
  EventDetailItem,
  PublicProfile,
} from '@founders-coffee/server-fns';

import { EventChat } from '../../features/chat/components/EventChat';
import { eventCityName } from '../../features/events/event-city-name';
import { eventStreetAddress } from '../../features/events/event-street-address';
import type { EventPhase } from '../../features/events/live-window';
import type { UseEventLiveResult } from '../../features/events/useEventLive';
import { localizedCity } from '../../lib/locale-routing';
import { EventHostCard } from './EventHostCard';
import { EventLocationMap } from './EventLocationMap';
import { EventRsvpBox } from './EventRsvpBox';
import { ShareEventButton } from './ShareEventButton';

type EventDetailProps = {
  locale: Locale;
  market: Market;
  event: EventDetailItem;
  host: PublicProfile | null;
  isHost: boolean;
  live: UseEventLiveResult | null;
  isWindowOpen: boolean;
  phase: EventPhase;
  mapboxToken: string | null;
};

export const EventDetail = ({
  locale,
  market,
  event,
  host,
  isHost,
  live,
  isWindowOpen,
  phase,
  mapboxToken,
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
  const names = locale === 'ar' ? 'long' : 'short';
  const day = on(start, { weekday: names, day: 'numeric', month: names });
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
  const streetAddress = eventStreetAddress(event);
  const contentDirection = locale === 'ar' ? 'rtl' : 'ltr';
  const isCancelled = event.status === 'cancelled';
  const isGoing = event.viewerRsvp === 'going';
  const isChatAvailable = market.featureFlags.meetupChat === true;
  const hasRsvpBox = isCancelled ? (isHost ? isChatAvailable : isGoing) : true;

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
        <StatusMessage variant="error" className="mb-4">
          <p className="font-display text-h4 font-semibold">
            {event_cancelled_title({}, { locale })}
          </p>
          <p className="mt-1 text-neutral">
            {event_cancelled_body({}, { locale })}
          </p>
          {event.cancellationReason ? (
            <p className="mt-2 text-base-content">
              <IsolatedValue
                value={event.cancellationReason}
                message={(reason) => ntf_cancel_reason({ reason }, { locale })}
              />
            </p>
          ) : null}
        </StatusMessage>
      )}

      <header className="rounded-box bg-base-200 p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-body-sm text-neutral">
            <MapPin className="size-4 text-secondary" aria-hidden="true" />
            <span dir="auto">{cityName}</span>
          </span>
        </div>
        <h1 className="mt-4 font-display text-h3 font-semibold text-balance md:text-h2">
          <bdi>{event.title}</bdi>
        </h1>
        {event.description ? (
          <p className="mt-4 max-w-3xl whitespace-pre-line text-body-lg leading-relaxed text-neutral">
            <IsolatedLines text={event.description} />
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
            mapboxToken={mapboxToken}
          />
        </div>
      ) : null}

      <h2
        id="event-details-title"
        className="mt-8 font-display text-h4 font-semibold"
      >
        {event_details_title({}, { locale })}
      </h2>

      <div
        className={`mt-4 grid gap-8 ${hasRsvpBox ? 'lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]' : ''}`}
      >
        <section
          aria-labelledby="event-details-title"
          className="flex flex-col"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_when({}, { locale })}</dt>
              <dd className="mt-1.5 flex items-start gap-2 font-medium">
                <CalendarDays
                  className="mt-0.5 size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <time dateTime={start.toISOString()}>{day}</time>
              </dd>
              <dd className="mt-0.5 ms-6 overflow-x-clip text-body-sm text-neutral">
                <span className="-ms-4 flex flex-wrap">
                  <span className="ms-4 font-medium text-base-content">
                    {timeRange}
                  </span>
                  <span className="relative ms-4 before:absolute before:-start-2.5 before:content-['·']">
                    {event_timezone(
                      { market: localizedName(market, locale) },
                      { locale },
                    )}
                  </span>
                </span>
              </dd>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_where({}, { locale })}</dt>
              <dd className="mt-1.5 flex items-start gap-2 font-medium">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-secondary"
                  aria-hidden="true"
                />
                <span>
                  <bdi>{event.venue}</bdi>
                </span>
              </dd>
              <dd className="mt-0.5 ps-6 text-body-sm text-neutral">
                <bdi>{streetAddress ?? cityName}</bdi>
              </dd>
            </div>
          </dl>

          <EventHostCard
            locale={locale}
            host={host}
            cityName={cityName}
            isHost={isHost}
          />
        </section>

        {hasRsvpBox ? (
          <EventRsvpBox
            locale={locale}
            event={event}
            hostName={hostName}
            marketSlug={market.slug}
            isHost={isHost}
            live={live}
            isWindowOpen={isWindowOpen}
            phase={phase}
            isChatAvailable={isChatAvailable}
          />
        ) : null}
      </div>

      {isChatAvailable ? (
        <EventChat
          locale={locale}
          eventId={event.id}
          title={event.title}
          isMember={isHost || isGoing}
          isCancelled={isCancelled}
          endsAt={end}
          timeZone={market.timezone}
        />
      ) : null}
    </article>
  );
};
