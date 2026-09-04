import { Link } from '@tanstack/react-router';

import {
  cat_coffee_meetup,
  cat_demo_day,
  cat_workshop,
  event_capacity,
  event_free,
  event_host,
  event_no_cap,
  event_when,
  open_in_maps,
  event_where,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type {
  EventWithAttendance,
  PublicProfile,
} from '@founders-coffee/server-fns';

import { RsvpSection } from './RsvpSection';

type EventDetailProps = {
  locale: Locale;
  market: Market;
  event: EventWithAttendance;
  host: PublicProfile;
};

const LANGUAGE_LABEL: Record<EventWithAttendance['language'], string> = {
  ar: 'AR',
  en: 'EN',
  fr: 'FR',
};

const categoryLabel = (
  category: EventWithAttendance['category'],
  locale: Locale,
): string =>
  category === 'coffee-meetup'
    ? cat_coffee_meetup({}, { locale })
    : category === 'workshop'
      ? cat_workshop({}, { locale })
      : cat_demo_day({}, { locale });

export const EventDetail = ({
  locale,
  market,
  event,
  host,
}: EventDetailProps) => {
  const when = formatDate(event.startsAt, locale, {
    timeZone: market.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const capacityText =
    event.capacity === 0
      ? event_no_cap({}, { locale })
      : `${event_capacity({}, { locale })}: ${event.capacity}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: new Date(event.startsAt).toISOString(),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: event.language,
    location: {
      '@type': 'Place',
      name: event.venue,
      address: event.venueAddress ?? undefined,
    },
    organizer: { '@type': 'Person', name: host.name },
  };

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap gap-2">
        <span className="badge badge-outline badge-primary">
          {categoryLabel(event.category, locale)}
        </span>
        <span className="badge badge-ghost">
          {LANGUAGE_LABEL[event.language]}
        </span>
        {event.isFree ? (
          <span className="badge badge-secondary">
            {event_free({}, { locale })}
          </span>
        ) : null}
      </div>

      <h1 className="mt-4 font-display text-h2 font-semibold text-balance">
        {event.title}
      </h1>

      <dl className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <dt className="eyebrow">{event_when({}, { locale })}</dt>
          <dd>{when}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="eyebrow">{event_where({}, { locale })}</dt>
          <dd>
            {event.venue}
            {event.venueAddress ? (
              <span className="text-neutral"> — {event.venueAddress}</span>
            ) : null}
            {event.latitude != null && event.longitude != null ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="ms-2 whitespace-nowrap text-label font-medium text-neutral underline decoration-secondary underline-offset-[3px] hover:text-base-content"
              >
                {open_in_maps({}, { locale })}
              </a>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <RsvpSection event={event} hostName={host.name} locale={locale} />
      </div>

      {event.description ? (
        <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed text-base-content">
          {event.description}
        </p>
      ) : null}

      <div className="mt-8 flex items-center gap-3 border-t border-base-300 pt-6">
        <span className="eyebrow">{event_host({}, { locale })}</span>
        <Link
          to="/u/$userId"
          params={{ userId: host.id }}
          className="link link-hover font-semibold"
        >
          {host.name}
        </Link>
      </div>

      <p className="mt-4 text-caption text-neutral">{capacityText}</p>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
};
